const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const ABI = require("../constants/endpoint_abi.json")

module.exports = async function (taskArgs, hre) {

    const contract = await ethers.getContract(taskArgs.contract)
    const oAppAddress = contract.address

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    const endpoint = await hre.ethers.getContractAt(ABI, lzEndpointAddress)

    const sendVersion = await endpoint.getSendVersion(oAppAddress)
    const receiveVersion = await endpoint.getReceiveVersion(oAppAddress)

    const latestVersion = await endpoint.latestVersion()
    const receiveUln301Version = latestVersion;
    const sendUln301Version = latestVersion - 1;
    
    if (sendVersion < sendUln301Version) {
        console.log(`You may optionally upgrade to the latest version of UltraLightNode301 for send. Latest version: ${sendUln301Version}. Current version: ${sendVersion}.`)
    }

    if (receiveVersion < receiveUln301Version) {
        console.log(`You may optionally upgrade to the latest version of UltraLightNode301 for receive. Latest version: ${receiveUln301Version}. Current version: ${receiveVersion}.`)
    }

}
