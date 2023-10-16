const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const ONFT_ARGS = {
    "bsc-testnet": {
        "startMintId": 1,
        "endMintId": 10
    },
    "fuji": {
        "startMintId": 11,
        "endMintId": 20
    },
    "goerli": {
        "startMintId": 21,
        "endMintId": 30
    }
}


module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    const onftArgs = ONFT_ARGS[hre.network.name]
    console.log({ onftArgs })
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    await deploy("ONFT721", {
        from: deployer,
        args: [lzEndpointAddress, onftArgs.startMintId, onftArgs.endMintId],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["ONFT721"]
