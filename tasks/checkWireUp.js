const CHAIN_ID = require("../constants/chainIds.json")

const environments = {
    mainnet: ["ethereum", "bsc", "avalanche", "polygon", "arbitrum", "optimism", "fantom"],
    testnet: ["rinkeby", "bsc-testnet", "fuji", "mumbai", "arbitrum-rinkeby", "optimism-kovan", "fantom-testnet"],
}

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
    const environment = hre.network.name
    const environmentArray = environments[taskArgs.e]
    let trustedRemoteTable = {}
    trustedRemoteTable[environment] = new TrustedRemote()
    await Promise.all(
        environmentArray.map(async (env) => {
            try {
                const contract = await ethers.getContract(taskArgs.contract)
                const dstChainId = CHAIN_ID[env]
                let envToCamelCase = env.replace(/-./g, (m) => m[1].toUpperCase())
                if (hre.network.name === env) {
                    trustedRemoteTable[environment][envToCamelCase] = await contract.address.toLowerCase()
                } else {
                    trustedRemoteTable[environment][envToCamelCase] = await contract.trustedRemoteLookup(dstChainId)
                }
            } catch (error) {
                //catch error because checkWireUpAll is reading console log as input
            }
        })
    )
    if (JSON.stringify(trustedRemoteTable[environment]).length > 2) {
        console.log(JSON.stringify(trustedRemoteTable[environment]))
    }
}
