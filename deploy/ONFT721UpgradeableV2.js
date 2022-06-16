const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const { ethers, upgrades } = require('hardhat');

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    //replace with the deployed ONFT721Upgradeable proxy address
    const proxyAddress = "0xaa91835c115DF128b36Ce2114247cA224AB82aE3"

    const ONFT721UpgradeableV2 = await ethers.getContractFactory("ONFT721UpgradeableV2");
    await upgrades.upgradeProxy(
        proxyAddress,
        ONFT721UpgradeableV2,
    );
    console.log("ONFT721UpgradeableV2 upgraded");

    // await deploy("ONFT721", {
    //     from: deployer,
    //     args: [lzEndpointAddress, onftArgs.startMintId, onftArgs.endMintId],
    //     log: true,
    //     waitConfirmations: 1,
    // })
}

module.exports.tags = ["ONFT721UpgradeableV2"]

