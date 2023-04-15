const { expect } = require("chai")
const { ethers } = require("hardhat")
const Web3 = require("web3")
const web3 = new Web3()

describe("ONFT721A: ", function () {
    const chainId_A = 1
    const chainId_B = 2
    const name = "OmnichainNonFungibleToken"
    const symbol = "ONFT721A"
    const defaultAdapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 250000])
    const batchSizeLimit = 300

    let owner, warlock, lzEndpointMockA, lzEndpointMockB, LZEndpointMock, ONFT721A, ONFT721, onft721a_A, onft721_B

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT721A = await ethers.getContractFactory("ONFT721AMock")
        ONFT721 = await ethers.getContractFactory("ONFT721Mock")
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
        lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)

        onft721a_A = await ONFT721A.deploy(name, symbol, 150000, lzEndpointMockA.address)
        onft721_B = await ONFT721.deploy(name, symbol, 150000, lzEndpointMockB.address)

        // wire the lz endpoints to guide msgs back and forth
        lzEndpointMockA.setDestLzEndpoint(onft721_B.address, lzEndpointMockB.address)
        lzEndpointMockB.setDestLzEndpoint(onft721a_A.address, lzEndpointMockA.address)

        // set each contracts source address so it can send to each other
        await onft721a_A.setTrustedRemoteAddress(chainId_B, onft721_B.address)
        await onft721_B.setTrustedRemoteAddress(chainId_A, onft721a_A.address)

        await onft721a_A.setMinDstGas(chainId_B, 1, 150000)
        await onft721_B.setMinDstGas(chainId_A, 1, 150000)
    })

    it("sendFrom() - your own tokens", async function () {
        let tokenId = 1;
        await onft721a_A.mint(2)

        // verify the owner of the token is on the source chain
        expect(await onft721a_A.ownerOf(0)).to.be.equal(owner.address)
        expect(await onft721a_A.ownerOf(1)).to.be.equal(owner.address)

        // token doesn't exist on other chain
        await expect(onft721_B.ownerOf(tokenId)).to.be.revertedWith("ERC721: invalid token ID")

        // can transfer token on srcChain as regular erC721
        await onft721a_A.transferFrom(owner.address, warlock.address, tokenId)
        expect(await onft721a_A.ownerOf(tokenId)).to.be.equal(warlock.address)

        // approve the contract to swap your token
        await onft721a_A.connect(warlock).approve(onft721a_A.address, tokenId)

        // estimate nativeFees
        let nativeFee = (await onft721a_A.estimateSendFee(chainId_B, owner.address, tokenId, false, defaultAdapterParams)).nativeFee

        // swaps token to other chain
        await onft721a_A.connect(warlock).sendFrom(
            warlock.address,
            chainId_B,
            warlock.address,
            tokenId,
            warlock.address,
            ethers.constants.AddressZero,
            defaultAdapterParams,
            { value: nativeFee }
        )

        // token is burnt
        expect(await onft721a_A.ownerOf(0)).to.be.equal(owner.address)
        expect(await onft721a_A.ownerOf(tokenId)).to.be.equal(onft721a_A.address)

        // token received on the dst chain
        expect(await onft721_B.ownerOf(tokenId)).to.be.equal(warlock.address)

        // can send to other onft contract eg. not the original nft contract chain
        await onft721_B.connect(warlock).sendFrom(
            warlock.address,
            chainId_A,
            owner.address,
            tokenId,
            warlock.address,
            ethers.constants.AddressZero,
            defaultAdapterParams,
            { value: nativeFee }
        )

        // token is burned on the sending chain
        expect(await onft721a_A.ownerOf(tokenId)).to.be.equal(owner.address)
        expect(await onft721_B.ownerOf(tokenId)).to.be.equal(onft721_B.address)
    })

    it("sendFrom() - reverts if not owner", async function () {
        const tokenId = 0
        await onft721a_A.mint(1)

        // approve the contract to swap your token
        await onft721a_A.approve(onft721a_A.address, tokenId)

        // estimate nativeFees
        let nativeFee = (await onft721_B.estimateSendFee(chainId_B, owner.address, tokenId, false, defaultAdapterParams)).nativeFee

        // swaps token to other chain
        await onft721a_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, defaultAdapterParams, { value: nativeFee })

        // token received on the dst chain
        expect(await onft721_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // reverts because other address does not own it
        await expect(
            onft721_B.connect(warlock).sendFrom(
                warlock.address,
                chainId_A,
                warlock.address,
                tokenId,
                warlock.address,
                ethers.constants.AddressZero,
                defaultAdapterParams,
                { value: nativeFee }
            )
        ).to.be.revertedWith("ONFT721: send caller is not owner nor approved")
    })

    it("sendFrom() - on behalf of other user", async function () {
        const tokenId = 0
        await onft721a_A.mint(1)

        // approve the contract to swap your token
        await onft721a_A.approve(onft721a_A.address, tokenId)

        // estimate nativeFees
        let nativeFee = (await onft721_B.estimateSendFee(chainId_B, owner.address, tokenId, false, defaultAdapterParams)).nativeFee

        // swaps token to other chain
        await onft721a_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, defaultAdapterParams, { value: nativeFee })

        // token received on the dst chain
        expect(await onft721_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // approve the other user to send the token
        await onft721_B.approve(warlock.address, tokenId)

        // sends across
        await onft721_B.connect(warlock).sendFrom(
            owner.address,
            chainId_A,
            warlock.address,
            tokenId,
            warlock.address,
            ethers.constants.AddressZero,
            defaultAdapterParams,
            { value: nativeFee }
        )

        // token received on the dst chain
        expect(await onft721a_A.ownerOf(tokenId)).to.be.equal(warlock.address)
    })

    it("sendFrom() - reverts if contract is approved, but not the sending user", async function () {
        const tokenId = 0
        await onft721a_A.mint(1)

        // approve the contract to swap your token
        await onft721a_A.approve(onft721a_A.address, tokenId)

        // estimate nativeFees
        let nativeFee = (await onft721_B.estimateSendFee(chainId_B, owner.address, tokenId, false, defaultAdapterParams)).nativeFee

        // swaps token to other chain
        await onft721a_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, defaultAdapterParams, { value: nativeFee })

        // token received on the dst chain
        expect(await onft721_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // approve the contract to swap your token
        await onft721_B.approve(onft721_B.address, tokenId)

        // reverts because contract is approved, not the user
        await expect(
            onft721_B.connect(warlock).sendFrom(
                owner.address,
                chainId_A,
                warlock.address,
                tokenId,
                warlock.address,
                ethers.constants.AddressZero,
                defaultAdapterParams,
                { value: nativeFee }
            )
        ).to.be.revertedWith("ONFT721: send caller is not owner nor approved")
    })

    it("sendFrom() - reverts if not approved", async function () {
        const tokenId = 0
        await onft721a_A.mint(1)

        // approve the contract to swap your token
        await onft721a_A.approve(onft721a_A.address, tokenId)

        // estimate nativeFees
        let nativeFee = (await onft721_B.estimateSendFee(chainId_B, owner.address, tokenId, false, defaultAdapterParams)).nativeFee

        // swaps token to other chain
        await onft721a_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, defaultAdapterParams, { value: nativeFee })

        // token received on the dst chain
        expect(await onft721_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // reverts because user is not approved
        await expect(
            onft721_B.connect(warlock).sendFrom(
                owner.address,
                chainId_A,
                warlock.address,
                tokenId,
                warlock.address,
                ethers.constants.AddressZero,
                defaultAdapterParams,
                { value: nativeFee }
            )
        ).to.be.revertedWith("ONFT721: send caller is not owner nor approved")
    })

    it("sendFrom() - reverts if sender does not own token", async function () {
        const tokenIdA = 0
        await onft721a_A.mint(1)

        // approve owner.address to transfer, but not the other
        await onft721a_A.setApprovalForAll(onft721a_A.address, true)

        // estimate nativeFees
        let nativeFee = (await onft721a_A.estimateSendFee(chainId_B, owner.address, tokenIdA, false, defaultAdapterParams)).nativeFee

        await expect(
            onft721a_A.connect(warlock).sendFrom(
                warlock.address,
                chainId_B,
                warlock.address,
                tokenIdA,
                warlock.address,
                ethers.constants.AddressZero,
                defaultAdapterParams,
                { value: nativeFee }
            )
        ).to.be.revertedWith("TransferFromIncorrectOwner()")

        await expect(
            onft721a_A.connect(warlock).sendFrom(
                warlock.address,
                chainId_B,
                owner.address,
                tokenIdA,
                owner.address,
                ethers.constants.AddressZero,
                defaultAdapterParams,
                { value: nativeFee }
            )
        ).to.be.revertedWith("TransferFromIncorrectOwner()")
    })

    it("sendBatchFrom()", async function () {
        await onft721a_A.setMinGasToTransferAndStore(400000)
        await onft721_B.setMinGasToTransferAndStore(400000)
        await onft721a_A.setDstChainIdToBatchLimit(chainId_B, batchSizeLimit)
        await onft721_B.setDstChainIdToBatchLimit(chainId_A, batchSizeLimit)
        const tokenIds = [0,1,2,3,4,5,6,7,8,9]
        // mint to owner
        await onft721a_A.connect(warlock).mint(10)

        // approve owner.address to transfer
        await onft721a_A.connect(warlock).setApprovalForAll(onft721a_A.address, true)

        // expected event params
        const payload = ethers.utils.defaultAbiCoder.encode(["bytes", "uint[]"], [warlock.address, tokenIds])
        const hashedPayload = web3.utils.keccak256(payload)

        let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

        // estimate nativeFees
        let nativeFee = (await onft721a_A.estimateSendBatchFee(chainId_B, warlock.address, tokenIds, false, defaultAdapterParams)).nativeFee

        // initiate batch transfer
        await expect(onft721a_A.connect(warlock).sendBatchFrom(
            warlock.address,
            chainId_B,
            warlock.address,
            tokenIds,
            warlock.address,
            ethers.constants.AddressZero,
            adapterParams, // TODO might need to change this
            { value: nativeFee }
        )).to.emit(onft721_B, "CreditStored").withArgs(hashedPayload, payload)

        // only partial amount of tokens has been sent, the rest have been stored as a credit
        let creditedIdsA = []
        for (let tokenId of tokenIds) {
            let owner = await onft721_B.rawOwnerOf(tokenId)
            if (owner == ethers.constants.AddressZero) {
                creditedIdsA.push(tokenId)
            } else {
                expect(owner).to.be.equal(warlock.address)
            }
        }

        // clear the rest of the credits
        await expect(onft721_B.clearCredits(payload)).to.emit(onft721_B, "CreditCleared").withArgs(hashedPayload)

        let creditedIdsB = []
        for (let tokenId of creditedIdsA) {
            let owner = await onft721_B.rawOwnerOf(tokenId)
            if (owner == ethers.constants.AddressZero) {
                creditedIdsB.push(tokenId)
            } else {
                expect(owner).to.be.equal(warlock.address)
            }
        }

        // all ids should have cleared
        expect(creditedIdsB.length).to.be.equal(0)

        // should revert because payload is no longer valid
        await expect(onft721_B.clearCredits(payload)).to.be.revertedWith("no credits stored")
    })

    it("sendBatchFrom() - large batch", async function () {
        await onft721a_A.setMinGasToTransferAndStore(400000)
        await onft721_B.setMinGasToTransferAndStore(400000)
        await onft721a_A.setDstChainIdToBatchLimit(chainId_B, batchSizeLimit)
        await onft721_B.setDstChainIdToBatchLimit(chainId_A, batchSizeLimit)

        const tokenIds = []

        for (let i = 0; i < 300; i++) {
            tokenIds.push(i)
        }

        // mint to owner
        for (let tokenId of tokenIds) {
            await onft721a_A.connect(warlock).mint(1)
        }

        // approve owner.address to transfer
        await onft721a_A.connect(warlock).setApprovalForAll(onft721a_A.address, true)

        // expected event params
        const payload = ethers.utils.defaultAbiCoder.encode(["bytes", "uint[]"], [warlock.address, tokenIds])
        const hashedPayload = web3.utils.keccak256(payload)

        let adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 400000])

        // estimate nativeFees
        let nativeFee = (await onft721a_A.estimateSendBatchFee(chainId_B, warlock.address, tokenIds, false, adapterParams)).nativeFee

        // initiate batch transfer
        await expect(onft721a_A.connect(warlock).sendBatchFrom(
            warlock.address,
            chainId_B,
            warlock.address,
            tokenIds,
            warlock.address,
            ethers.constants.AddressZero,
            adapterParams, // TODO might need to change this
            { value: nativeFee }
        )).to.emit(onft721_B, "CreditStored").withArgs(hashedPayload, payload)

        // only partial amount of tokens has been sent, the rest have been stored as a credit
        let creditedIdsA = []
        for (let tokenId of tokenIds) {
            let owner = await onft721_B.rawOwnerOf(tokenId)
            if (owner == ethers.constants.AddressZero) {
                creditedIdsA.push(tokenId)
            } else {
                expect(owner).to.be.equal(warlock.address)
            }
        }

        // console.log("Number of tokens credited: ", creditedIdsA.length)

        // clear the rest of the credits
        let tx = await(await onft721_B.clearCredits(payload)).wait()

        // console.log("Total gasUsed: ", tx.gasUsed.toString())

        let creditedIdsB = []
        for (let tokenId of creditedIdsA) {
            let owner = await onft721_B.rawOwnerOf(tokenId)
            if (owner == ethers.constants.AddressZero) {
                creditedIdsB.push(tokenId)
            } else {
                expect(owner).to.be.equal(warlock.address)
            }
        }

        // console.log("Number of tokens credited: ", creditedIdsB.length)

        // all ids should have cleared
        expect(creditedIdsB.length).to.be.equal(0)

        // should revert because payload is no longer valid
        await expect(onft721_B.clearCredits(payload)).to.be.revertedWith("no credits stored")
    })
})