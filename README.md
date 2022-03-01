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

1. Deploy 2+ OmniCounters and send a cross chain message by calling incrementCounter()

```
npx hardhat --network fuji deploy
npx hardhat --network mumbai deploy 
````

2. When you deploy, it will output something like:
```
deploying "OmniCounter" (tx: 0xf1219eb9f29a54300b998c48e6dcb02900a0d8499f0829282ffa7f39727fa5c4)...: deployed at 0xA79595A48a01b7a3A5AfA8cD62cfEC9F3f7EAfE5 with 1758818 gas
```

3. Copy the address of the target deployed OmniCounter, in this case for `mumbai` `0xA79595A48a01b7a3A5AfA8cD62cfEC9F3f7EAfE5```


4. Call the command below to send a cross chain message from `fuji` to `mumbai` !
```angular2html
npx hardhat --network fuji omniCounterIncrement --dst-chain-id 10009 --dst-addr 0xA79595A48a01b7a3A5AfA8cD62cfEC9F3f7EAfE5
```


5. Use this command to poll the counter on the destination to wait for the cross chain message
```
npx hardhat --network mumbai omniCounterPoll    
```



### For further reading, and a list of endpoint ids and deployed LayerZero contract addresses please take a look at the Gitbook here: https://layerzero.gitbook.io/