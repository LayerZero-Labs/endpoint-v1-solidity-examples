const ENDPOINTS = require('../constants/layerzeroEndpoints.json')

// DocsCounterMock
module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(deployer)

    // get the Endpoint address
    const endpointAddr = ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint address: ${endpointAddr}`)

    await deploy("OmniCounter", {
        from: deployer,
        args: [endpointAddr],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["OmniCounter"]
