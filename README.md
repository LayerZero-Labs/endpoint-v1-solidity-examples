# Simple LayerZero Omni Chain Contracts

### Setup the project
```shell
npm install
```
 
 ### Run tests
```shell
npx hardhat test
```

### NOTE: You must add a .env with a MNEMONIC that is funded on testnets !
configure an .env file to have the values of .env.example and test deploy! (Use a real LayerZero endpoint in place of 0x0000..) 

# OmnichainFungibleToken - Send Tokens to another chain
> WARNING: **THIS CONTRACT IS OF BUSINESS LICENSE. CONTACT US BEFORE YOU USED IN PRODUCTION.**
>
> LayerZero is pushing a new cross-chain token standard with permissive license soon
>
> Stay tuned for maximum cross-chain compatability of your token

The OmnichainFungibleToken standardized libraries will have a main chain and an all chain implementation for you to choose from. 
In the all chain implementation you will burn and mint between all chains you include without a home base. 
In this example we follow the main chain described in detail below.

The OmnichainFungibleToken contract sets a main chain to mint the initial supply of OFT's.
The default main chain in this example is set to ```rinkeby```.
This setting is configured in ```constants/oftMainChain.json```.
The OmnichainFungibleToken contract deployed on other chains will use this configuration to set there main chain.
Using the Ethereum network ```(testnet: rinkeby)``` as the source of truth was a security decision.
In the event a chain goes rogue, Ethereum will be the final source of truth for OFT tokens.
When sending tokens to other chains this contract locks the tokens on the main chain and mints on the destination chain.
When other non-main chains send OFT's to each other they will burn and mint accordingly. 
When sending back to the main chain it will burn on the source chain and unlock on the main chain.

1. deploy two contracts with one being the main, in this case it is ```rinkeby```
```angular2html
 npx hardhat --network rinkeby deploy --tags OmnichainFungibleToken
 npx hardhat --network fuji deploy --tags OmnichainFungibleToken
```
2. set the destinations, so each contract can receive messages from one another
```angular2html
npx hardhat --network rinkeby omnichainFungibleTokenSetDestination --target-network fuji
npx hardhat --network fuji omnichainFungibleTokenSetDestination --target-network rinkeby
```
3. send some OFT tokens
```angular2html
npx hardhat --network rinkeby omnichainFungibleTokenSendTokens --target-network fuji --qty 250
```


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

