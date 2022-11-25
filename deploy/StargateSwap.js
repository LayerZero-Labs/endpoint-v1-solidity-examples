const STARGATE = require("../constants/stargate.json")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    const stargateRouter = STARGATE.router[hre.network.name]
    const widgetSwap = STARGATE.widgetSwap[hre.network.name]
    const partnerId = "0x0001"
    console.log(`[${hre.network.name}] Stargate Router address: ${stargateRouter}`)
    console.log(`[${hre.network.name}] Widget Swap address: ${widgetSwap}`)
    console.log(`[${hre.network.name}] Partner Id: ${partnerId}`)

    await deploy("StargateSwap", {
        from: deployer,
        args: [stargateRouter, widgetSwap, partnerId],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["StargateSwap"]
