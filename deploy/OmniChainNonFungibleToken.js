const LZ_ENDPOINTS = require('../constants/layerzeroEndpoints.json')

module.exports = async function({deployments, getNamedAccounts}) {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    console.log(`>>> your address: ${deployer}`)

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name];
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    await deploy("OmniChainNonFungibleToken", {
        from: deployer,
        args: ["OmniChainNonFungibleToken", "OCNFT", lzEndpointAddress],
        log: true,
        waitConfirmations: 1
    })
}

module.exports.tags = ["OmniChainNonFungibleToken"]