const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const { ethers, upgrades } = require('hardhat');

module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    const ONFT721Upgradeable = await ethers.getContractFactory("ONFT721Upgradeable");
    const lzApp = await upgrades.deployProxy(
        ONFT721Upgradeable,
        ["name", "symbol", lzEndpointAddress],
        {initializer: "initializeONFT721Upgradeable"}
    );
    await lzApp.deployed();
    console.log("ONFT721Upgradeable deployed to:", lzApp.address);
}

module.exports.tags = ["ONFT721Upgradeable"]

