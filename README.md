# Simple LayerZero multi chain contracts

### Setup the project
```shell
npm install
```
 
 ### Run tests
```shell
npx hardhat test
```

### See some examples in `/contracts`  🙌

Many of the example contracts make use of LayerZeroEndpointMock.sol which is a nice way to test LayerZero locally!


### Most recently tested with node version `16.13.1` 

###
configure an .env file to have the values of .env.example and test deploy! (Use a real LayerZero endpoint in place of 0x0000..) 

# Testing Cross Chain Messages

1. Deploy both OmniCounters and send a cross chain message by calling the scripts below:

```
npx hardhat --network fuji deploy
npx hardhat --network mumbai deploy 
````

2. Call the command below to send a cross chain message from `fuji` to `mumbai` !
```angular2html
npx hardhat --network fuji omniCounterIncrement --target-network mumbai
```


3. Optionally use this command in a separate terminal watch the counter on the destination
```
npx hardhat --network mumbai omniCounterPoll    
```



### For further reading, and a list of endpoint ids and deployed LayerZero contract addresses please take a look at the Gitbook here: https://layerzero.gitbook.io/


### Read the currently set Oracle
```npx hardhat --network fuji omniCounterGetOracle```

### Set a custom Oracle for the deployed OmniCounter
```npx hardhat --network fuji omniCounterSetOracle --target-network mumbai --oracle 0xORACLE_ADDR```