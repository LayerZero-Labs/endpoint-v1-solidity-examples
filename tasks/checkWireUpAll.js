const shell = require("shelljs")
const environments = require("../constants/environments.json")

let trustedRemoteTable = {}
let trustedRemoteChecks = {}
const MAX_TRYS = 10

function TrustedRemoteTestnet() {
    this.rinkeby
    this.bscTestnet
    this.fuji
    this.mumbai
    this.arbitrumRinkeby
    this.optimismKovan
    this.fantomTestnet
}

function TrustedRemote() {
    this.ethereum
    this.bsc
    this.avalanche
    this.polygon
    this.arbitrum
    this.optimism
    this.fantom
}

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

module.exports = async function (taskArgs) {
    const networks = environments[taskArgs.e]
    if (!taskArgs.e || networks.length === 0) {
        console.log(`Invalid environment argument: ${taskArgs.e}`)
    }
    // loop through all networks and fill up trustedRemoteTable
    await Promise.all(
        networks.map(async (network) => {
            let result;
            let resultParsed;
            let trys = 0
            while(true) {
                let checkWireUpCommand;
                if(network === taskArgs.proxyChain) {
                    checkWireUpCommand = `npx hardhat --network ${network} checkWireUp --e ${taskArgs.e} --contract ${taskArgs.proxyContract}`
                } else {
                    checkWireUpCommand = `npx hardhat --network ${network} checkWireUp --e ${taskArgs.e} --contract ${taskArgs.contract}`
                }
                console.log("checkWireUp: " + checkWireUpCommand)
                // remove spaces and new lines from stdout
                result = shell.exec(checkWireUpCommand).stdout.replace(/(\r\n|\n|\r|\s)/gm, "")
                // remove extra words before JSON object, so it can be parsed correctly
                result = result.substring(result.indexOf("{"));
                // make sure it is JSON otherwise the network does not have this contract deployed
                if(!isJsonString(result)) {
                    trustedRemoteTable[network] = new TrustedRemote()
                    break;
                }
                // parse result into JSON object
                resultParsed = JSON.parse(result)
                // make sure all chain ids are set if so we break
                if(Object.keys(resultParsed).length === networks.length) {
                    break;
                }
                // we will retry a max of 10 times otherwise we throw an error to stop infinite while loop
                else if(trys === MAX_TRYS) {
                    throw new Error(`Retired the max amount of times for ${network}`);
                }
                // sometimes the returned JSON is missing chains so retry until they are all set properly
                else {
                    ++trys;
                    console.log(`On retry:${trys} for ${network}`)
                }
            }
            trustedRemoteTable[network] = taskArgs.e === "mainnet" ? new TrustedRemote() : new TrustedRemoteTestnet();
            // assign new passed object to the trustedRemoteTable[network]
            Object.assign(trustedRemoteTable[network], resultParsed)
            // if trustedRemoteTable[network] is not empty then set trustedRemoteChecks[network]
            if (Object.keys(trustedRemoteTable[network]).length > 0) {
                trustedRemoteChecks[network] = taskArgs.e === "mainnet" ? new TrustedRemote() : new TrustedRemoteTestnet();
            }
        })
    )

    console.table(trustedRemoteTable)

    // use filled trustedRemoteTable to make trustedRemoteChecks
    const environmentArray = environments[taskArgs.e]
    for (let i = 0; i < environmentArray.length; i++) {
        if (trustedRemoteTable[environmentArray[i]] === undefined) continue
        const envToCamelCase = environmentArray[i].replace(/-./g, (m) => m[1].toUpperCase())
        const actualUaAddress = trustedRemoteTable[environmentArray[i]][envToCamelCase]
        if (actualUaAddress === undefined) continue
        console.log(`${environmentArray[i]}'s actualUaAddress: ${actualUaAddress}`)
        for (let j = 0; j < environmentArray.length; j++) {
            if (trustedRemoteTable[environmentArray[j]] === undefined) continue
            const currentSetRemoteAddress = trustedRemoteTable[environmentArray[j]][envToCamelCase]
            if (currentSetRemoteAddress !== undefined) {
                console.log(
                    `${environmentArray[j]}'s currentSetRemoteAddress for ${environmentArray[i]}: ${currentSetRemoteAddress} ${
                        JSON.stringify(actualUaAddress) === JSON.stringify(currentSetRemoteAddress) ? "✅ " : "❌ "
                    }`
                )
                if (JSON.stringify(actualUaAddress) === JSON.stringify(currentSetRemoteAddress)) {
                    if(environmentArray[i] === environmentArray[j]) {
                        trustedRemoteChecks[environmentArray[j]][envToCamelCase] = ""
                    } else {
                        trustedRemoteChecks[environmentArray[j]][envToCamelCase] = "🟩"
                    }
                } else if (JSON.stringify(actualUaAddress) !== JSON.stringify(currentSetRemoteAddress)) {
                    console.log({envToCamelCase})
                    trustedRemoteChecks[environmentArray[j]][envToCamelCase] = "🟥"
                }
            }
        }
    }
    console.log("Legend")
    console.log("Set: 🟩")
    console.log("Not Set: 🟥")
    console.table(trustedRemoteChecks)
}