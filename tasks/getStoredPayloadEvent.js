const LZ_ENDPOINTS = require("../constants/layerzeroEndpoints.json");
const ABI = require("../constants/endpoint_abi.json")

module.exports = async function (taskArgs, hre) {
    let blockStart = (await ethers.provider.getTransaction(taskArgs.txStart)).blockNumber
    let blockEnd = taskArgs.txEnd !== undefined ? (await ethers.provider.getTransaction(taskArgs.txEnd)).blockNumber : await ethers.provider.getBlockNumber();

    console.log(`blockStart: ${blockStart} -> blockEnd: ${blockEnd}`)
    console.log(hre.network.name)
    console.log(LZ_ENDPOINTS[hre.network.name])

    const lzEndpointAddress = LZ_ENDPOINTS[hre.network.name]
    const endpoint = await hre.ethers.getContractAt(ABI, lzEndpointAddress)

    // concat remote and local address
    let remoteAndLocal = hre.ethers.utils.solidityPack(
        ['address','address'],
        [taskArgs.srcAddress, taskArgs.desAddress]
    )

    const step = taskArgs.step
    for (let from = blockStart; from <= blockEnd; from += step + 1) {
        const to = Math.min(from + step, blockEnd)
        const deposits = await endpoint.queryFilter(endpoint.filters.PayloadStored(), from, to)
        for (const e of deposits) {
            // event PayloadStored(uint16 srcChainId, bytes srcAddress, address dstAddress, uint64 nonce, bytes payload, bytes reason);
            let storedPayload = {
                "block": `${from}`,
                "srcChainId": `${e?.args[0].toString()}`,
                "srcAddress": `${e?.args[1].toString()}`,
                "dstAddress": `${e?.args[2].toString()}`,
                "nonce": `${e?.args[3].toString()}`,
                "payload": `${e?.args[4].toString()}`,
                "reason": `${e?.args[5].toString()}`
            }

            if(e.args[1] === remoteAndLocal) console.log(storedPayload)
            if(e.args[1] === remoteAndLocal && taskArgs.nonce !== undefined && storedPayload.nonce === taskArgs.nonce) {
                console.log(`Attempting to clear nonce: ${e.args[3].toString()}`)
                let tx = await (await endpoint.retryPayload(e.args[0], e.args[1], e?.args[4],{gasLimit: 200000})).wait();
                console.log("txHash:" + tx.transactionHash);
            }
        }
    }
}


// npx hardhat --network bsc-testnet getStoredPayloadEvent --tx-start TX_HASH_SRC --src-address TBD --des-address TBD
// npx hardhat --network bsc-testnet getStoredPayloadEvent --tx-start 0xf74b8a299ff58651d8f4e2411f5459b7f703b2582404a34a657e247a8463cb84 --src-address 0xff7e5f0faf0cba105cdb875833b801355fa58aa0 --des-address 0x2ef82e5c7afb10f70a704efebc15036d0e5864b1

// to clear nonce
// npx hardhat --network bsc-testnet getStoredPayloadEvent --tx-start 0xf74b8a299ff58651d8f4e2411f5459b7f703b2582404a34a657e247a8463cb84 --src-address 0xff7e5f0faf0cba105cdb875833b801355fa58aa0 --des-address 0x2ef82e5c7afb10f70a704efebc15036d0e5864b1 --nonce 8
