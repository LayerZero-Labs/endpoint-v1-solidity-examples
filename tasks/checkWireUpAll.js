const shell = require("shelljs")

const environments = {
    mainnet: ["ethereum", "bsc", "avalanche", "polygon", "arbitrum", "optimism", "fantom"],
    testnet: ["rinkeby", "bsc-testnet", "fuji", "mumbai", "arbitrum-rinkeby", "optimism-kovan", "fantom-testnet"],
}

let trustedRemoteTable = {}
let trustedRemoteChecks = {}

function TrustedRemote() {
    this.rinkeby
    this.bscTestnet
    this.fuji
    this.mumbai
    this.arbitrumRinkeby
    this.optimismKovan
    this.fantomTestnet
}

module.exports = async function (taskArgs) {
    const networks = environments[taskArgs.e]
    if (!taskArgs.e || networks.length === 0) {
        console.log(`Invalid environment argument: ${taskArgs.e}`)
    }
    // fill up trustedRemoteTable
    await Promise.all(
        networks.map(async (network) => {
            try {
                const checkWireUpCommand = `npx hardhat --network ${network} checkWireUp --e testnet --contract ${taskArgs.contract}`
                const result = shell.exec(checkWireUpCommand).stdout.replace(/(\r\n|\n|\r|\s)/gm, "")
                if (result !== "") {
                    const resultParsed = JSON.parse(result)
                    trustedRemoteTable[network] = new TrustedRemote()
                    Object.assign(trustedRemoteTable[network], resultParsed)
                    if (JSON.stringify(trustedRemoteTable[network]).length > 2) {
                        trustedRemoteChecks[network] = new TrustedRemote()
                    }
                }
            } catch (e) {
                console.log({ e })
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
                    trustedRemoteChecks[environmentArray[j]][envToCamelCase] = "🟩"
                } else if (JSON.stringify(actualUaAddress) !== JSON.stringify(currentSetRemoteAddress)) {
                    trustedRemoteChecks[environmentArray[j]][envToCamelCase] = "🟥"
                }
            }
        }
    }
    console.table(trustedRemoteChecks)
}
