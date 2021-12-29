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


``` npx hardhat --network mumbai deploy --endpoint 0x0000000000000000000000000000000000000000```