// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @dev Tempo EarnVault look-alike: ERC-4626-style share math over the asset balance it holds.
///      Yield is simulated by minting/transferring asset to the vault; loss by `slash`.
///      Mirrors the real vault's non-zero-minimum rule and can be told to refuse `withdrawExact`.
contract MockEarnVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    mapping(address => uint256) public shares;
    uint256 public totalEarnShares;
    bool public depositsPaused;
    bool public failWithdrawExact;

    error ZeroMinimumEarnShares();
    error ZeroMinimumAssets();
    error MinimumEarnSharesNotMet();
    error MinimumAssetsNotMet();
    error ExceedsMaxEarnShares();
    error DepositsPaused();
    error WithdrawExactDisabled();
    error NoEarnShares();

    constructor(IERC20 token_) {
        token = token_;
    }

    // ---- admin knobs for tests ----
    function setDepositsPaused(bool v) external {
        depositsPaused = v;
    }

    function setFailWithdrawExact(bool v) external {
        failWithdrawExact = v;
    }

    /// Simulate a venue loss: move assets out.
    function slash(uint256 assets, address to) external {
        token.safeTransfer(to, assets);
    }

    // ---- views ----
    function asset() external view returns (address) {
        return address(token);
    }

    function earnShare() external view returns (address) {
        return address(this);
    }

    function totalAssets() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        uint256 ta = totalAssets();
        if (totalEarnShares == 0 || ta == 0) return assets;
        return (assets * totalEarnShares + ta - 1) / ta; // ceil
    }

    function previewRedeem(uint256 earnShares) public view returns (uint256) {
        if (totalEarnShares == 0) return earnShares;
        return (earnShares * totalAssets()) / totalEarnShares;
    }

    // ---- actions ----
    function deposit(uint256 assets, address receiver, uint256 minEarnShares) external returns (uint256 earnShares) {
        if (minEarnShares == 0) revert ZeroMinimumEarnShares();
        if (depositsPaused) revert DepositsPaused();
        uint256 ta = totalAssets();
        earnShares = (totalEarnShares == 0 || ta == 0) ? assets : (assets * totalEarnShares) / ta;
        if (earnShares < minEarnShares) revert MinimumEarnSharesNotMet();
        token.safeTransferFrom(msg.sender, address(this), assets);
        shares[receiver] += earnShares;
        totalEarnShares += earnShares;
    }

    function redeem(uint256 earnShares, address receiver, uint256 minAssets) external returns (uint256 assets) {
        if (minAssets == 0) revert ZeroMinimumAssets();
        if (shares[msg.sender] < earnShares) revert NoEarnShares();
        assets = previewRedeem(earnShares);
        if (assets < minAssets) revert MinimumAssetsNotMet();
        shares[msg.sender] -= earnShares;
        totalEarnShares -= earnShares;
        token.safeTransfer(receiver, assets);
    }

    function withdrawExact(uint256 assets, address receiver, uint256 maxEarnShares) external returns (uint256 burned) {
        if (failWithdrawExact) revert WithdrawExactDisabled();
        burned = previewWithdraw(assets);
        if (burned > maxEarnShares) revert ExceedsMaxEarnShares();
        if (shares[msg.sender] < burned) revert NoEarnShares();
        if (assets > totalAssets()) revert MinimumAssetsNotMet();
        shares[msg.sender] -= burned;
        totalEarnShares -= burned;
        token.safeTransfer(receiver, assets);
    }
}
