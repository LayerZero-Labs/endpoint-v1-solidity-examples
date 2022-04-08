# Simple LayerZero Omni Chain Contracts

 ### Install & Run tests
```shell
npm install
npx hardhat test 
```

# OmnichainFungibleToken - Send Tokens to another chain
> WARNING: **YOU NEED TO PERFORM THE SET TRUSTED SOURCES STEP.** Don't forget, nah you won't forget.
>
> LayerZero Labs will publicize a new cross-chain token standard with permissive license soon

The `OmnichainFungibleToken` and `OmnichainNonFungibleToken` standardized libraries will have two varieties of deployments. Only one may be chosen:
 1. `Main chain & Child chain(s)` 
 2. `All Chain`  

 In the `Main chain & Child Chain` variety, all tokens transferred out of the main chain will be locked (and minted on destination), and tokens transferred out of `child` chains will be burned (and minted on destination). This results in the `Main Chain` being like a home base. The initialy supply will only be minted entirely on the `Main Chain` on deployment. Our `OmnichainFungibleToken` example will follow the `Main chain & Child Chain` standardization.
 
 In the `All Chain` implementation token transfers will always be burn & mint. The deployer may mint tokens in each deployment. Our `OmnichainNonFungibleToken` example will follow the `All Chains` standardization.

In the example deployment below, the default main chain is ```rinkeby```.
This setting is configured in ```constants/oftMainChain.json```.
The `OmnichainFungibleToken` deployed on other chains will use this configuration to set their main chain.
Using the Ethereum network ```(testnet: rinkeby)``` as a source of truth is a security decision.
In the event a chain goes rogue, Ethereum will be the final source of truth for OFT tokens.
When sending tokens to other chains this contract locks the tokens on the main chain and mints on the destination chain.
When other non-main chains send OFT's to each other they will burn and mint accordingly. 
When sending back to the main chain it will burn on the source chain and unlock on the main chain.

# Are you down with OFT?
1. Deploy two contracts:  ```rinkeby``` is the main chain
```angular2html
 npx hardhat --network rinkeby deploy --tags OmnichainFungibleToken
 npx hardhat --network fuji deploy --tags OmnichainFungibleToken
```
2. Set the trusted sources, so each contract can receive messages from one another, and `only` one another.
```angular2html
npx hardhat --network rinkeby omnichainFungibleTokenSetDestination --target-network fuji
npx hardhat --network fuji omnichainFungibleTokenSetDestination --target-network rinkeby
```
3. Send tokens across chains
```angular2html
npx hardhat --network rinkeby omnichainFungibleTokenSendTokens --target-network fuji --qty 250
```
#### Note: Remember to add a .env file with your MNEMONIC=""

# OmnichainNonFungibleToken - Send an ONFT to another chain
> WARNING: **YOU NEED TO PERFORM THE SET TRUSTED SOURCES STEP.**

In the `All Chain` implementation we deploy the contracts on the chains with a starting token id and max mint number. 
The key is to separate the token ids so no same token id can be minted on different chains. 
For our OmnichainNonFungibleToken example we deploy to two chains, `bsc-testnet` and `fuji`. 
We set the starting token id on `bsc-testnet` to `0` and max mint to `50`. On `fuji` we set the starting token id to `50` and max mint to `100`.
This way no same token id can be minted on the same chain. These setting are configured in ```constants/onftArgs.json```.
When a transfer occurs between chains the ONFT will be `burned` on the source chain and `minted` on the destination chain.

# Go Omnichain: Be the Deployooooor
1. Deploy two contracts:
```angular2html
 npx hardhat --network bsc-testnet deploy --tags OmnichainNonFungibleToken
 npx hardhat --network fuji deploy --tags OmnichainNonFungibleToken
```
2. Set the trusted sources, so each contract can receive messages from one another, and `only` one another.
```angular2html
 npx hardhat --network bsc-testnet omnichainNonFungibleTokenSetTrustedSource --target-network fuji
 npx hardhat --network fuji omnichainNonFungibleTokenSetTrustedSource --target-network bsc-testnet
```
3. Mint your ONFT on each chain!
```angular2html
 npx hardhat --network bsc-testnet omnichainNonFungibleTokenMint
 npx hardhat --network fuji omnichainNonFungibleTokenMint
```
4. Verify you are the owner of that token on that chain
```angular2html
 npx hardhat --network bsc-testnet  omnichainNonFungibleTokenOwnerOf --token-id 1
 npx hardhat --network fuji omnichainNonFungibleTokenOwnerOf --token-id 51
```
5. Send ONFT's across chains
```angular2html
npx hardhat --network bsc-testnet omnichainNonFungibleTokenTransfer --target-network fuji --token-id 1
```
6. Verify your token no longer exists on the source chain
```angular2html
 npx hardhat --network bsc-testnet  omnichainNonFungibleTokenOwnerOf --token-id 1
```
7. Lastly verify your token exist on the destination chain
```angular2html
npx hardhat --network fuji  omnichainNonFungibleTokenOwnerOf --token-id 1
```

#### Note: Remember to add a .env file with your MNEMONIC=""

# Testing Cross Chain Messages

1. Deploy both OmniCounters:

```
npx hardhat --network bsc-testnet deploy --tags OmniCounter
npx hardhat --network fuji deploy --tags OmniCounter
````

2. Set the remote addresses, so each contract can receive messages
```angular2html
npx hardhat --network bsc-testnet omniCounterSetDestination --target-network fuji
npx hardhat --network fuji omniCounterSetDestination --target-network bsc-testnet
```
3. Send a cross chain message from `bsc-testnet` to `fuji` !
```angular2html
npx hardhat --network bsc-testnet omniCounterIncrementCounter --target-network fuji
```

Optionally use this command in a separate terminal to watch the counter increment in real-time.
```
npx hardhat --network fuji omniCounterPoll    
```

# Testing Multiple Cross Chain Messages

1. Deploy both OmniCounters:

```
npx hardhat --network bsc-testnet deploy --tags OmniCounter
npx hardhat --network fuji deploy --tags OmniCounter
npx hardhat --network mumbai deploy --tags OmniCounter
npx hardhat --network fantom-testnet deploy --tags OmniCounter
````

2. Set the remote addresses, so each contract can receive messages
```angular2html
npx hardhat --network bsc-testnet omniCounterSetDestination --target-network fuji
npx hardhat --network fuji omniCounterSetDestination --target-network bsc-testnet

npx hardhat --network bsc-testnet omniCounterSetDestination --target-network mumbai
npx hardhat --network mumbai omniCounterSetDestination --target-network bsc-testnet

npx hardhat --network bsc-testnet omniCounterSetDestination --target-network fantom-testnet
npx hardhat --network fantom-testnet omniCounterSetDestination --target-network bsc-testnet
```
3. Send a cross chain message from `mumbai` to `fuji` !
```angular2html
npx hardhat --network bsc-testnet omniCounterIncrementMultiCounter --target-networks fuji,mumbai,fantom-testnet
```

Optionally use this command in a separate terminal to watch the counter increment in real-time.
```
npx hardhat --network fuji omniCounterPoll
npx hardhat --network mumbai omniCounterPoll
npx hardhat --network fantom-testnet omniCounterPoll
```
# Getting and Setting the Oracle

### Read the currently set Oracle
```npx hardhat --network bsc-testnet omniCounterGetOracle --target-network fantom-testnet```

### Set a custom Oracle for the deployed OmniCounter
```npx hardhat --network bsc-testnet omniCounterSetOracle --target-network fantom-testnet --oracle 0x000000000000000000000000000000000000dEaD```
#
### See some examples in `/contracts`  🙌

Many of the example contracts make use of LayerZeroEndpointMock.sol which is a nice way to test LayerZero locally!

### For further reading, and a list of endpoint ids and deployed LayerZero contract addresses please take a look at the Gitbook here: https://layerzero.gitbook.io/

## Most recently tested with node version `16.13.1` 

