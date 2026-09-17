// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IEarnVault
/// @notice Subset of Tempo's EarnVault interface (viem/tempo `Abis.earnVault`) used by the Vouch Vault.
///         Shares are a TIP-20 "Earn Share" token held by the depositor (`receiver`).
///         Minimums must be non-zero (`ZeroMinimumEarnShares` / `ZeroMinimumAssets` otherwise).
interface IEarnVault {
    function asset() external view returns (address);
    function earnShare() external view returns (address);
    function depositsPaused() external view returns (bool);
    function previewWithdraw(uint256 assets) external view returns (uint256 earnShares);
    function previewRedeem(uint256 earnShares) external view returns (uint256 assets);
    function deposit(uint256 assets, address receiver, uint256 minEarnShares) external returns (uint256 earnShares);
    function redeem(uint256 earnShares, address receiver, uint256 minAssets) external returns (uint256 assets);
    function withdrawExact(uint256 assets, address receiver, uint256 maxEarnShares)
        external
        returns (uint256 earnSharesBurned);
}
