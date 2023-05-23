module.exports = async function (taskArgs, hre) {
    let blockStart = (await ethers.provider.getTransaction(taskArgs.txStart)).blockNumber
    let blockEnd = taskArgs.txEnd !== undefined ? (await ethers.provider.getTransaction(taskArgs.txEnd)).blockNumber : await ethers.provider.getBlockNumber();

    if(taskArgs.blockStart) {
        blockStart = taskArgs.blockStart;
    }
    console.log(`blockStart: ${blockStart} -> blockEnd: ${blockEnd}`)
    const contract = await ethers.getContractAt("NonblockingLzApp", taskArgs.dstUa)
    const step = taskArgs.step
    for (let from = blockStart; from <= blockEnd; from += step + 1) {
        const to = Math.min(from + step, blockEnd)
        const deposits = await contract.queryFilter(contract.filters.MessageFailed(), from, to)
        for (const e of deposits) {
            // event MessageFailed(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _payload, bytes _reason);
            let messageFailed = {
                "block": `${from}`,
                "srcChainId": `${e?.args[0].toString()}`,
                "srcAddress": `${e?.args[1].toString()}`,
                "nonce": `${e?.args[2].toString()}`,
                "payload": `${e?.args[3].toString()}`,
                "reason": `${e?.args[4].toString()}`
            }
            console.log(messageFailed)
            if(taskArgs.nonce !== undefined && messageFailed.nonce === taskArgs.nonce) {
                console.log(`Attempting to clear nonce: ${e.args[3].toString()}`)
                let tx = await (await contract.retryMessage(messageFailed.srcChainId, messageFailed.srcAddress, messageFailed.nonce, messageFailed.payload)).wait();
                console.log("txHash:" + tx.transactionHash);
            }
        }
    }
}

// npx hardhat --network goerli getMessageFailedEvent --tx-start TX_HASH_SRC --tx-end TX_HASH_DST --dstUA DST_ADDRESS --nonce NONCE_TO_CLEAR

