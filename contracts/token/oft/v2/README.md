## IMPORTANT: OFTV2

In order to make the token balance compatible on Aptos e.g. using uint64 to represent balance, OFTV2 has a shared decimal point setting to normalize the data type difference. 

It is recommended to use a smaller shared decimal point on all chains so that your token can have a larger balance. For example, if the decimal point is 18, then you can not have more than approximately 18 * 10^18 tokens bounded by the uint64.max
