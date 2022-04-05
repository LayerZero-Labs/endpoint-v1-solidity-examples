// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/ILayerZeroEndpoint.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroUserApplicationConfig.sol";


//---------------------------------------------------------------------------
// THIS CONTRACT IS OF BUSINESS LICENSE. CONTACT US BEFORE YOU USE IT.
//
// LayerZero is pushing now a new cross-chain token standard with permissive license soon
//
// Stay tuned for maximum cross-chain compatability of your token
//---------------------------------------------------------------------------
contract OmnichainFungibleToken is ERC20, Ownable, ILayerZeroReceiver, ILayerZeroUserApplicationConfig {
    ILayerZeroEndpoint immutable public endpoint;
    mapping(uint16 => bytes) public dstContractLookup;  // a map of the connected contracts
    bool public paused;                                 // indicates cross chain transfers are paused
    bool public isMain;                                 // indicates this contract is on the main chain

    event Paused(bool isPaused);
    event SendToChain(uint16 srcChainId, bytes toAddress, uint256 qty, uint64 nonce);
    event ReceiveFromChain(uint16 srcChainId, address toAddress, uint256 qty, uint64 nonce);

    constructor(
        string memory _name,
        string memory _symbol,
        address _endpoint,
        uint16 _mainChainId,
        uint256 _initialSupplyOnMainEndpoint
    ) ERC20(_name, _symbol) {
        // only mint the total supply on the main chain
        if (ILayerZeroEndpoint(_endpoint).getChainId() == _mainChainId) {
            _mint(msg.sender, _initialSupplyOnMainEndpoint);
            isMain = true;
        }
        // set the LayerZero endpoint
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    function pauseSendTokens(bool _pause) external onlyOwner {
        paused = _pause;
        emit Paused(_pause);
    }

    function setDestination(uint16 _dstChainId, bytes calldata _destinationContractAddress) public onlyOwner {
        dstContractLookup[_dstChainId] = _destinationContractAddress;
    }

    function chainId() external view returns (uint16){
        return endpoint.getChainId();
    }

    function sendTokens(
        uint16 _dstChainId,             // send tokens to this LayerZero chainId
        bytes calldata _to,             // address where tokens are delivered on destination chain
        uint256 _qty,                   // quantity of tokens to send
        address _zroPaymentAddress,     // ZRO payment address
        bytes calldata _adapterParam    // adapterParameters (can configure dst gasAmoount or add airdrop, refer to LayerZero docs)
    ) public payable {
        require(!paused, "OFT: sendTokens() is currently paused");

        if (isMain) {
            // lock by transferring to this contract if leaving the main chain,
            _transfer(msg.sender, address(this), _qty);
        } else {
            // burn if leaving non-main chain
            _burn(msg.sender, _qty);
        }

        // abi.encode() the payload
        bytes memory payload = abi.encode(_to, _qty);

        // send LayerZero message
        endpoint.send{value: msg.value}(
            _dstChainId,                    // destination chainId
            dstContractLookup[_dstChainId], // destination UA address
            payload,                        // abi.encode()'ed bytes
            payable(msg.sender),            // refund address (LayerZero will refund any extra gas back to msg.sender
            _zroPaymentAddress,             // payment address if paying in token
            _adapterParam                   // adapterParameters
        );
        uint64 nonce = endpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_dstChainId, _to, _qty, nonce);
    }

    function lzReceive(
        uint16 _srcChainId,
        bytes memory _fromAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external override {
        require(msg.sender == address(endpoint)); // lzReceive must only be called by the endpoint
        require(
            _fromAddress.length == dstContractLookup[_srcChainId].length && keccak256(_fromAddress) == keccak256(dstContractLookup[_srcChainId]),
            "OFT: invalid source sending contract"
        );

        // decode and load the toAddress
        (bytes memory _to, uint256 _qty) = abi.decode(_payload, (bytes, uint256));
        address toAddress;
        assembly { toAddress := mload(add(_to, 20)) }

        // if the toAddress is 0x0, burn it
        if (toAddress == address(0x0)) toAddress == address(0xdEaD);

        // on the main chain unlock via transfer, otherwise _mint
        if (isMain) {
            _transfer(address(this), toAddress, _qty);
        } else {
            _mint(toAddress, _qty);
        }

        emit ReceiveFromChain(_srcChainId, toAddress, _qty, _nonce);
    }

    function estimateSendTokensFee(uint16 _dstChainId, bytes calldata _toAddress, bool _useZro, bytes calldata _txParameters) external view returns (uint256 nativeFee, uint256 zroFee) {
        // mock the payload for sendTokens()
        bytes memory payload = abi.encode(_toAddress, 1);
        return endpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _txParameters);
    }

    //---------------------------DAO CALL----------------------------------------
    // generic config for user Application
    function setConfig(
        uint16 _version,
        uint16 _chainId,
        uint256 _configType,
        bytes calldata _config
    ) external override onlyOwner {
        endpoint.setConfig(_version, _chainId, _configType, _config);
    }

    function setSendVersion(uint16 _version) external override onlyOwner {
        endpoint.setSendVersion(_version);
    }

    function setReceiveVersion(uint16 _version) external override onlyOwner {
        endpoint.setReceiveVersion(_version);
    }

    function forceResumeReceive(uint16 _srcChainId, bytes calldata _srcAddress) external override onlyOwner {
        endpoint.forceResumeReceive(_srcChainId, _srcAddress);
    }

    function renounceOwnership() public override onlyOwner {}
}