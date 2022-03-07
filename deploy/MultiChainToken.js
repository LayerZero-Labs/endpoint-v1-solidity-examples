const ENDPOINTS = require('../constants/layerzeroEndpoints.json')

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}` )

    // get the Endpoint address
    const endpointAddr = ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint address: ${endpointAddr}`)

    await deploy("MultiChainToken", {
        from: deployer,
        args: ["MultiChainToken", "MCT", endpointAddr],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["MultiChainToken"]
