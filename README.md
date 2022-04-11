# LayerZero Omnichain Contracts

 ### Install & Run tests
```shell
npm install
npx hardhat test 
```

* The examples in the `example` folder are meant for demonstrating LayerZero messaging behaviours. 
* Always audit your own code and test extensively on `testnet` before going to mainnet 🙏



> WARNING: For all examples that follow: You *must* perform the `setTrustedRemote` on each of your deployed contracts to allow inbound/outboud messages for all remote contracs.

# OmnichainFungibleToken

The `OmnichainFungibleToken` has two varieties of deployments:
 1. `BasedOFT.sol` - The token supply is minted at deploy time on the `base` chain. Other chains deploy with 0 supply initially. 
 2. `OFT.sol` - At deploy time, any token supply can be minted on the local chain.    

 For the `BasedOFT` variety, all tokens transferred out of the `base` chain will be locked in the base contract (and minted on destination), and tokens transferred out of `other` chains will be burned on that chain (and minted on destination). This results in the `Base chain` being like the home base. The initial supply will be minted entirely on the `Base Chain` on deployment.
 
In the example deployment below we use `BasedOFT` and the `base` chain is ```rinkeby```.
This setting is configured in ```constants/oftBaseChain.json```.
The `OmnichainFungibleToken` deployed on other chains will use this configuration to set their `base` chain.
Using the Ethereum network ```(testnet: rinkeby)``` as a `base` (really its like the source of truth) is a security decision.
In the event a chain goes rogue, Ethereum will be the final source of truth for OFT tokens.

# Are you down [to deploy] with OFT?
1. Deploy two contracts:  ```rinkeby``` is the `base` chain
```angular2html
 npx hardhat --network rinkeby deploy --tags BasedOFT
 npx hardhat --network fuji deploy --tags BasedOFT
```
2. Set the "trusted remotes" (ie: your contracts) so each of them can receive messages from one another, and `only` one another.
```angular2html
npx hardhat --network rinkeby oftSetTrustedRemote --target-network fuji
npx hardhat --network fuji oftSetTrustedRemote --target-network rinkeby
```
3. Send tokens from rinkeby to fuji
```angular2html
npx hardhat --network rinkeby oftSendTokens --target-network fuji --qty 250
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
3. Send a cross chain message from `mumbai` to `fuji` !
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

