// Subset of Tempo's EarnVault ABI (from viem/tempo Abis.earnVault). Do not edit; regenerate from viem.
export const earnVaultAbi = [
  {
    "type": "function",
    "name": "asset",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "assets",
        "type": "uint256"
      },
      {
        "name": "receiver",
        "type": "address"
      },
      {
        "name": "minEarnShares",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "earnShares",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "depositsPaused",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "earnShare",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "engine",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewRedeem",
    "inputs": [
      {
        "name": "earnShares",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "assets",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "previewWithdraw",
    "inputs": [
      {
        "name": "assets",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "earnShares",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "redeem",
    "inputs": [
      {
        "name": "earnShares",
        "type": "uint256"
      },
      {
        "name": "receiver",
        "type": "address"
      },
      {
        "name": "minAssets",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "assets",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "remainingDepositCapacity",
    "inputs": [],
    "outputs": [
      {
        "name": "assets",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalAssets",
    "inputs": [],
    "outputs": [
      {
        "name": "assets",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalEarnShares",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdrawExact",
    "inputs": [
      {
        "name": "assets",
        "type": "uint256"
      },
      {
        "name": "receiver",
        "type": "address"
      },
      {
        "name": "maxEarnShares",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "earnSharesBurned",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Deposited",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "indexed": true
      },
      {
        "name": "receiver",
        "type": "address",
        "indexed": true
      },
      {
        "name": "assets",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "earnShares",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Redeemed",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "indexed": true
      },
      {
        "name": "receiver",
        "type": "address",
        "indexed": true
      },
      {
        "name": "earnShares",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "assets",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WithdrewExact",
    "inputs": [
      {
        "name": "caller",
        "type": "address",
        "indexed": true
      },
      {
        "name": "receiver",
        "type": "address",
        "indexed": true
      },
      {
        "name": "assets",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "earnSharesBurned",
        "type": "uint256",
        "indexed": false
      }
    ],
    "anonymous": false
  }
] as const;
