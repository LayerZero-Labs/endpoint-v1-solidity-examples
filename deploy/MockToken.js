module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    await deploy("MockToken", {
        from: deployer,
        args: ["test", "t"],
        log: true,
        waitConfirmations: 2,
    })

    await hre.run("verifyContract", { contract: "MockToken" })
}

module.exports.tags = ["MockToken"]
