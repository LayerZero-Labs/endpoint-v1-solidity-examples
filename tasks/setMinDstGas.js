const CHAIN_ID = require("../constants/chainIds.json")

module.exports = async function (taskArgs, hre) {
	const contract = await ethers.getContract(taskArgs.contract)
	const dstChainId = CHAIN_ID[taskArgs.targetNetwork]
	const tx = await contract.setMinDstGas(dstChainId, taskArgs.packetType, taskArgs.minGas)
	
	console.log(`[${hre.network.name}] setMinDstGas tx hash ${tx.hash}`)
	await tx.wait()
}