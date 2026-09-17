// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {VaultBase} from "./VaultBase.t.sol";
import {Vault} from "../src/Vault.sol";
import {IZonePortal} from "../src/interfaces/IZonePortal.sol";
import {MockZonePortal, MockZonePortalLegacy} from "./mocks/MockZonePortal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Private payout into a Tempo Zone (F12): available balance → allow-listed portal `depositEncrypted`,
/// user is the refund recipient, ledger shrinks by the amount, signature binds portal/token/amount/payload.
contract VaultZoneTest is VaultBase {
    MockZonePortal internal portal;
    uint128 internal constant FEE = 1_000; // portal deposit fee in token units

    function setUp() public override {
        super.setUp();
        portal = new MockZonePortal(6, address(usd), FEE);
        vm.prank(owner);
        vault.setZonePortal(address(portal), true, false);
    }

    function payload() internal pure returns (IZonePortal.EncryptedPayload memory p) {
        p.ephemeralPubkeyX = keccak256("ephemeral");
        p.ephemeralPubkeyYParity = 1;
        p.ciphertext = hex"deadbeef";
        p.nonce = bytes12(keccak256("nonce"));
        p.tag = bytes16(keccak256("tag"));
    }

    function test_setZonePortal_admin() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setZonePortal(address(portal), false, false);
        vm.prank(owner);
        vm.expectRevert(Vault.ZeroAddress.selector);
        vault.setZonePortal(address(0), true, false);
        vm.prank(owner);
        vault.setZonePortal(address(portal), false, false);
        assertFalse(vault.allowedZonePortal(address(portal)));
        // disallowing clears the legacy flag too
        vm.prank(owner);
        vault.setZonePortal(address(portal), true, true);
        assertTrue(vault.legacyZonePortal(address(portal)));
        vm.prank(owner);
        vault.setZonePortal(address(portal), false, true);
        assertFalse(vault.legacyZonePortal(address(portal)));
    }

    function test_withdrawToZone_movesBalanceIntoPortalEncrypted() public {
        depositAs(worker, AMOUNT);
        uint256 accountedBefore = vault.accounted(address(usd));
        vm.prank(worker);
        vm.expectEmit(true, true, true, true);
        emit Vault.WithdrawnToZone(address(usd), worker, address(portal), AMOUNT);
        vault.withdrawToZone(address(portal), address(usd), AMOUNT, 0, payload());

        assertEq(vault.balances(address(usd), worker), 0);
        assertEq(vault.accounted(address(usd)), accountedBefore - AMOUNT, "ledger shrank by the amount");
        assertEq(usd.balanceOf(address(portal)), AMOUNT, "portal holds the tokens");
        assertEq(usd.balanceOf(address(vault)), 0);
        MockZonePortal.Record memory r = portal.last();
        assertEq(r.sender, address(vault), "portal sees the vault as sender (payload was prepared for it)");
        assertEq(r.refundTo, worker, "user is the refund recipient if the deposit bounces");
        assertEq(r.net, uint128(AMOUNT) - FEE, "portal deducts its fee from the amount");
        assertEq(r.payloadHash, keccak256(abi.encode(payload())), "payload forwarded intact");
        assertGe(
            usd.balanceOf(address(vault)) + vault.deployed(address(usd)), vault.accounted(address(usd)), "solvency"
        );
    }

    function test_withdrawToZone_reverts() public {
        depositAs(worker, AMOUNT);
        vm.startPrank(worker);
        vm.expectRevert(abi.encodeWithSelector(Vault.ZonePortalNotAllowed.selector, address(0xBEEF)));
        vault.withdrawToZone(address(0xBEEF), address(usd), AMOUNT, 0, payload());
        vm.expectRevert(Vault.ZeroAmount.selector);
        vault.withdrawToZone(address(portal), address(usd), 0, 0, payload());
        vm.expectRevert(Vault.InsufficientBalance.selector);
        vault.withdrawToZone(address(portal), address(usd), AMOUNT + 1, 0, payload());
        vm.expectRevert(Vault.AmountTooLarge.selector);
        vault.withdrawToZone(address(portal), address(usd), uint256(type(uint128).max) + 1, 0, payload());
        vm.stopPrank();

        portal.setActive(address(usd), false);
        vm.prank(worker);
        vm.expectRevert(Vault.ZoneDepositsInactive.selector);
        vault.withdrawToZone(address(portal), address(usd), AMOUNT, 0, payload());
        portal.setActive(address(usd), true);

        // a reverting portal leaves the ledger untouched
        portal.setFail(true);
        vm.prank(worker);
        vm.expectRevert(MockZonePortal.Forced.selector);
        vault.withdrawToZone(address(portal), address(usd), AMOUNT, 0, payload());
        assertEq(vault.balances(address(usd), worker), AMOUNT);
    }

    function test_withdrawToZone_worksWhilePaused() public {
        depositAs(worker, AMOUNT);
        vm.prank(owner);
        vault.pause();
        vm.prank(worker);
        vault.withdrawToZone(address(portal), address(usd), AMOUNT, 0, payload());
        assertEq(usd.balanceOf(address(portal)), AMOUNT);
    }

    function test_withdrawToZoneWithSig_bindsPayload() public {
        depositAs(worker, AMOUNT);
        uint256 deadline = vm.getBlockTimestamp() + 1 hours;
        IZonePortal.EncryptedPayload memory p = payload();
        bytes32 sh = keccak256(
            abi.encode(
                vault.ZONE_WITHDRAW_TYPEHASH(),
                address(portal),
                address(usd),
                AMOUNT,
                uint256(0),
                keccak256(abi.encode(p)),
                uint256(0),
                deadline
            )
        );
        bytes memory sig = sign(workerKey, sh);

        // tampered payload → different hash → bad signature (fresh struct: memory assignment would alias `p`)
        IZonePortal.EncryptedPayload memory tampered = payload();
        tampered.ciphertext = hex"c0ffee";
        vm.prank(stranger);
        vm.expectRevert(Vault.BadSignature.selector);
        vault.withdrawToZoneWithSig(address(portal), address(usd), AMOUNT, 0, tampered, worker, deadline, sig);

        vm.prank(stranger); // relayer pays gas
        vault.withdrawToZoneWithSig(address(portal), address(usd), AMOUNT, 0, p, worker, deadline, sig);
        assertEq(usd.balanceOf(address(portal)), AMOUNT);
        assertEq(vault.nonces(worker), 1);
        assertEq(portal.last().refundTo, worker);
    }

    /// Older portals without a refund-recipient argument are reached through the legacy fallback.
    function test_withdrawToZone_legacyPortalFallback() public {
        MockZonePortalLegacy legacy = new MockZonePortalLegacy(FEE);
        vm.prank(owner);
        vault.setZonePortal(address(legacy), true, true);
        depositAs(worker, AMOUNT);
        vm.prank(worker);
        vault.withdrawToZone(address(legacy), address(usd), AMOUNT, 0, payload());
        assertEq(legacy.lastSender(), address(vault));
        assertEq(legacy.lastNet(), uint128(AMOUNT) - FEE);
        assertEq(legacy.lastPayloadHash(), keccak256(abi.encode(payload())));
        assertEq(usd.balanceOf(address(legacy)), AMOUNT);
        assertEq(vault.balances(address(usd), worker), 0);

        // a modern portal flagged legacy gets the 4-arg call it does not implement -> reverts, ledger untouched
        vm.prank(owner);
        vault.setZonePortal(address(portal), true, true);
        depositAs(worker, AMOUNT);
        vm.prank(worker);
        vm.expectRevert();
        vault.withdrawToZone(address(portal), address(usd), AMOUNT, 0, payload());
        assertEq(vault.balances(address(usd), worker), AMOUNT);
    }

    /// End to end: a settled worker sends the payout straight into the zone without it ever touching a public wallet.
    function test_settledPayout_goesPrivatelyToZone() public {
        bytes32 job = keccak256("zone-job");
        createAndFund(job, worker, AMOUNT, manualPolicy());
        submitAs(worker, job);
        vm.prank(payer);
        vault.settle(job, AMOUNT, SCOPE, SALT);
        uint256 net = AMOUNT - feeOn(AMOUNT);
        assertEq(vault.balances(address(usd), worker), net);
        vm.prank(worker);
        vault.withdrawToZone(address(portal), address(usd), net, 0, payload());
        assertEq(vault.balances(address(usd), worker), 0);
        assertEq(usd.balanceOf(worker), 1_000_000_000, "worker's public wallet never received the payout");
        assertEq(portal.last().net, uint128(net) - FEE);
    }
}
