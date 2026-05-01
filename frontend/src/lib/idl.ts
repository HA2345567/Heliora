export const IDL: any = {
  version: "0.1.0",
  name: "prediction_market",
  address: "By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT",
  metadata: {
    address: "By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT"
  },
  instructions: [
    {
      name: "initializeMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "collateralMint", isMut: false, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "outcomeAMint", isMut: true, isSigner: false },
        { name: "outcomeBMint", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "settlementDeadline", type: "i64" },
      ],
    },
    {
      name: "splitTokens",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "outcomeAMint", isMut: true, isSigner: false },
        { name: "outcomeBMint", isMut: true, isSigner: false },
        { name: "userOutcomeA", isMut: true, isSigner: false },
        { name: "userOutcomeB", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "mergeTokens",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "outcomeAMint", isMut: true, isSigner: false },
        { name: "outcomeBMint", isMut: true, isSigner: false },
        { name: "userOutcomeA", isMut: true, isSigner: false },
        { name: "userOutcomeB", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" }
      ],
    },
    {
      name: "setWinningSide",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
        { name: "outcomeAMint", isMut: true, isSigner: false },
        { name: "outcomeBMint", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "winner", type: { defined: { name: "WinningOutcome" } } },
      ],
    },
    {
      name: "claimRewards",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "outcomeAMint", isMut: true, isSigner: false },
        { name: "outcomeBMint", isMut: true, isSigner: false },
        { name: "userOutcomeA", isMut: true, isSigner: false },
        { name: "userOutcomeB", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" }
      ],
    }
  ],
  types: [
    {
      name: "WinningOutcome",
      type: {
        kind: "enum",
        variants: [
          { name: "OutcomeA" },
          { name: "OutcomeB" },
          { name: "Neither" }
        ]
      }
    }
  ]
};
