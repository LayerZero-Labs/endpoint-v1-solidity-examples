const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)
    const globalSupply = ethers.utils.parseUnits("1000000", 18)

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    await deploy("ExampleOFTv2Upgradeable", {
        from: deployer,
        log: true,
        waitConfirmations: 1,
        proxy: {
            owner: deployer,
            proxyContract: "OptimizedTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["ExampleOFTv2Upgradeable", "OFTv2", 6, globalSupply, lzEndpointAddress],
                },
            },
        },
    })
}

module.exports.tags = ["ExampleOFTv2Upgradeable"]
