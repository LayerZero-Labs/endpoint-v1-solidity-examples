const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer, proxyOwner } = await getNamedAccounts()

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    await deploy("ExampleOFT20Upgradeable", {
        // gasLimit,
        from: deployer,
        log: true,
        waitConfirmations: 1,
        // skipIfAlreadyDeployed: true,
        proxy: {
            owner: proxyOwner,
            proxyContract: "OptimizedTransparentProxy",
            execute: {
                init: {
                    methodName: "initialize",
                    args: ["name", "symbol", lzEndpointAddress],
                },
                onUpgrade: {
                    methodName: "initialize",
                    args: ["name", "symbol", lzEndpointAddress],
                }
            },
        },
    })
}

module.exports.tags = ["ExampleOFT20Upgradeable"]
