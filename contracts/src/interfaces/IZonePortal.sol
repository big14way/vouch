// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IZonePortal
/// @notice Subset of the Tempo Zone Portal (viem/tempo `Abis.zonePortal`) used for private payouts.
///         `depositEncrypted` locks `amount` of a TIP-20 on Tempo and has the zone sequencer credit the
///         recipient encrypted inside `encrypted` (ECIES secp256k1 + AES-256-GCM to the sequencer key at
///         `keyIndex`). If decryption fails the funds bounce back to `tempoRefundRecipient` on Tempo.
///         Tempo Zones are testnet-only at the time of writing.
interface IZonePortal {
    struct EncryptedPayload {
        bytes32 ephemeralPubkeyX;
        uint8 ephemeralPubkeyYParity;
        bytes ciphertext;
        bytes12 nonce;
        bytes16 tag;
    }

    function zoneId() external view returns (uint32);
    function areDepositsActive(address token) external view returns (bool);
    function calculateDepositFee() external view returns (uint128 fee);
    function isEncryptionKeyValid(uint256 keyIndex) external view returns (bool valid, uint64 expiresAtBlock);
    function depositEncrypted(
        address token,
        uint128 amount,
        uint256 keyIndex,
        EncryptedPayload calldata encrypted,
        address tempoRefundRecipient
    ) external returns (bytes32 newCurrentDepositQueueHash);
}

/// @notice Older portal builds (Moderato Zone A, Sept 2026) take no refund recipient: bounce-backs return to the
///         sender, i.e. the Vouch Vault, where they surface as surplus that intake attributes back to the user.
interface IZonePortalLegacy {
    function depositEncrypted(
        address token,
        uint128 amount,
        uint256 keyIndex,
        IZonePortal.EncryptedPayload calldata encrypted
    ) external returns (bytes32 newCurrentDepositQueueHash);
}
