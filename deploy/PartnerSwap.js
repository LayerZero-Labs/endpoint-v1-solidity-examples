const STARGATE = require('../constants/stargate.json')

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    const stargateRouter = STARGATE.router[hre.network.name]
    const stargateRouterETH = STARGATE.routerETH[hre.network.name]
    const stargateFactory = STARGATE.factory[hre.network.name]
    console.log(`[${hre.network.name}] Stargate Router address: ${stargateRouter}`)
    console.log(`[${hre.network.name}] Stargate RouterETH address: ${stargateRouterETH}`)
    console.log(`[${hre.network.name}] Stargate Factory address: ${stargateFactory}`)

    await deploy("PartnerSwap", {
        from: deployer,
        args: [stargateRouter, stargateRouterETH, stargateFactory],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["PartnerSwap"]