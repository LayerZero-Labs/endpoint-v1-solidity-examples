const CHAIN_ID = {
    "ethereum":         101,
    "bsc":              102,
    "avalanche":        106,
    "polygon":          109,
    "arbitrum":         110,
    "optimism":         111,
    "fantom":           112,
    "metis":            151,
    "base":             184,
    "linea":            183,
    "kava":             177
}

const STG_FACTORIES = {
    "ethereum": "0x06D538690AF257Da524f25D0CD52fD85b1c2173E",
    "bsc": "0xe7Ec689f432f29383f217e36e680B5C855051f25",
    "avalanche": "0x808d7c71ad2ba3FA531b068a2417C63106BC0949",
    "polygon": "0x808d7c71ad2ba3FA531b068a2417C63106BC0949",
    "arbitrum": "0x55bDb4164D28FBaF0898e0eF14a589ac09Ac9970",
    "optimism": "0xE3B53AF74a4BF62Ae5511055290838050bf764Df",
    "fantom": "0x9d1B1669c73b033DFe47ae5a0164Ab96df25B944",
    "metis": "0xAF54BE5B6eEc24d6BFACf1cce4eaF680A8239398",
    "kava": "0xAF54BE5B6eEc24d6BFACf1cce4eaF680A8239398",
    "linea": "0xAF54BE5B6eEc24d6BFACf1cce4eaF680A8239398",
    "base": "0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6"
}

const STG_BRIDGE = {
    "ethereum": "0x296F55F8Fb28E498B858d0BcDA06D955B2Cb3f97",
    "bsc": "0x6694340fc020c5E6B96567843da2df01b2CE1eb6",
    "avalanche": "0x9d1B1669c73b033DFe47ae5a0164Ab96df25B944",
    "polygon": "0x9d1B1669c73b033DFe47ae5a0164Ab96df25B944",
    "arbitrum": "0x352d8275AAE3e0c2404d9f68f6cEE084B5bEB3DD",
    "optimism": "0x701a95707A0290AC8B90b3719e8EE5b210360883",
    "fantom": "0x45A01E4e04F14f7A4a6702c74187c5F6222033cd",
    "metis": "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
    "kava": "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
    "linea": "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
    "base": "0xAF54BE5B6eEc24d6BFACf1cce4eaF680A8239398"
}

const SWAP_REMOTE_UA_PAYLOAD_ENCODING = [
    'uint8', // TYPE_SWAP_REMOTE
    'uint256', // _srcPoolId
    'uint256', // _dstPoolId
    'uint256', // _lzTxParams.dstGasForCall
    'creditObj(uint256,uint256)', // _c
    'swapObj(uint256,uint256,uint256,uint256,uint256,uint256)', // _s
    'bytes', // _to
    'bytes', // _payload
]

let FACTORY_ABI = [
    "function getPool(uint256) view returns(address)"
];

let POOL_ABI = [
    "function token() view returns(address)",
    "function convertRate() view returns(uint256)"
];

const STARGATE_RECEIVER_INTERFACE_ABI = [
    "function sgReceive(uint16 _chainId, bytes memory _srcAddress, uint256 _nonce, address _token, uint256 amountLD, bytes memory payload)"
];

const STARGATE_COMPOSER_ABI = [
    "function clearCachedSwap(uint16 _srcChainId,bytes calldata _srcAddress,uint64 _nonce,address _receiver,bytes calldata _sgReceiveCallData)",
    "function payloadHashes(uint16,bytes,uint256) view returns(bytes32)"
];

const STARGATE_COMPOSER_ADDRESS = "0xeCc19E177d24551aA7ed6Bc6FE566eCa726CC8a9"
const DST_POOL_ID_INDEX = 2;
const SWAP_OBJ_INDEX = 5;
const AMOUNT_INDEX = 0
const EQ_REWARD_INDEX = 2;
const PAYLOAD_INDEX = 7;

module.exports = async function (taskArgs, hre) {
    const srcNetwork = taskArgs.srcNetwork;
    const nonce = taskArgs.nonce;
    const uaPayload = taskArgs.uaPayload

    const srcChainId = CHAIN_ID[srcNetwork];
    const srcAddress = hre.ethers.utils.solidityPack(
        ['address','address'],
        [STG_BRIDGE[srcNetwork], STG_BRIDGE[hre.network.name]]
    )

    const decodedPayload = ethers.utils.defaultAbiCoder.decode(
        SWAP_REMOTE_UA_PAYLOAD_ENCODING,
        uaPayload,
    )

    const factoryAddress = STG_FACTORIES[hre.network.name]
    const factory = await ethers.getContractAt(FACTORY_ABI, factoryAddress);

    const dstPoolId = decodedPayload[DST_POOL_ID_INDEX];
    const poolAddress = await factory.getPool(dstPoolId.valueOf())
    const pool = await ethers.getContractAt(POOL_ABI, poolAddress);

    const token = await pool.token();
    const convertRate = (await pool.convertRate()).valueOf();

    const amount = decodedPayload[SWAP_OBJ_INDEX][AMOUNT_INDEX].valueOf()
    const eqReward = decodedPayload[SWAP_OBJ_INDEX][EQ_REWARD_INDEX].valueOf()
    const amountLD = (amount + eqReward) * convertRate;

    const receiver = ethers.utils.hexDataSlice(decodedPayload[PAYLOAD_INDEX], 0, 20)
    const callDataSrcAddress = ethers.utils.hexDataSlice(decodedPayload[PAYLOAD_INDEX], 20, 40)
    const payload = ethers.utils.hexDataSlice(decodedPayload[PAYLOAD_INDEX], 40)

    const interfaceStargateReceiver = new ethers.utils.Interface(STARGATE_RECEIVER_INTERFACE_ABI);
    const sgReceiveCallData = interfaceStargateReceiver.encodeFunctionData("sgReceive", [ srcChainId, callDataSrcAddress, nonce, token, amountLD, payload])

    console.log({srcChainId,srcAddress,nonce,receiver,sgReceiveCallData})

    if(taskArgs.clear) {
        const stargateComposer = await ethers.getContractAt(STARGATE_COMPOSER_ABI, STARGATE_COMPOSER_ADDRESS);
        const currentPayloadHash = await stargateComposer.payloadHashes(srcChainId,srcAddress,nonce);
        const encodedPacked = ethers.utils.solidityPack(["address", "bytes"], [receiver, sgReceiveCallData])
        const hash = ethers.utils.keccak256(encodedPacked);

        if(currentPayloadHash === ethers.constants.HashZero) {
            console.log("Nothing to clear. Cache Swap empty.");
            return
        } else if(currentPayloadHash !== hash) {
            console.log("Cached Payload Hash doesnt match.");
            return
        }

        try {
            const tx = await (await stargateComposer.clearCachedSwap(srcChainId,srcAddress,nonce,receiver,sgReceiveCallData)).wait();
            console.log(`tx: ${tx.transactionHash}`)
        } catch (e) {
            if(e?.error?.message) {
                console.log(e.error.message)
            } else {
                console.log(e)
            }
        }
    }
}
