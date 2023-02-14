const { getEndpointIdByName,CHAIN_ID} = require("@layerzerolabs/lz-sdk")
const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json")
const ULNABIV2 = require("../constants/ULNABIV2.json")

module.exports = async function (taskArgs, hre) {
  //Will format later
  const ULNABI = ULNABIV2
  const endpointABI = [
    "function getSendLibraryAddress(address _userApplication) external view returns (address)",
    "function getReceiveLibraryAddress(address _userApplication) external view returns (address)",
    "function getSendVersion(address _userApplication) external view returns (uint16)",
    "function getReceiveVersion(address _userApplication) external view returns (uint16)"
  ]

  //Considering adding the ABIs for the contracts to constants. Will reorg after decided
  
  let endPoint = await hre.ethers.getContractAt(endpointABI,LZ_ENDPOINTS[hre.network.name])
  let sLA = await endPoint.getSendLibraryAddress(taskArgs.ua)
  let rLA = await endPoint.getReceiveLibraryAddress(taskArgs.ua)
  let sV = await endPoint.getSendVersion(taskArgs.ua)
  let rV = await endPoint.getReceiveVersion(taskArgs.ua)
  let ultraLightNode = await hre.ethers.getContractAt(ULNABI,sLA)
  const targetNetworks = taskArgs.targetNetworks.split(",")

console.log(`send library version = ${sV}
receive library version = ${rV}
send library address = ${sLA}
receive library address = ${rLA}
source chain: ${hre.network.name}`)

for(const targetNetwork of targetNetworks) {
  let targetEndpointId = getEndpointIdByName(targetNetwork)
  let appConfig = await ultraLightNode.getAppConfig(targetEndpointId, taskArgs.ua)
  let inboundProfLib = await ultraLightNode.inboundProofLibrary(targetEndpointId, appConfig.inboundProofLibraryVersion)

  let formattedAppConfig = {
    targetNetwork: targetNetwork,
    targetChainId: targetEndpointId,
    inboundProofLibraryAddress: inboundProfLib,
    inboundProofLibraryVersion: appConfig.inboundProofLibraryVersion,
    inboundBlockConfirmations: appConfig.inboundBlockConfirmations.toString(),
    relayer: appConfig.relayer.toString(),         
    outboundProofType: appConfig.outboundProofType,     
    outboundBlockConfirmations: appConfig.outboundBlockConfirmations.toString(),
    oracle: appConfig.oracle.toString()
      }

  console.table(formattedAppConfig)
}
}




