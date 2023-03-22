const { expect } = require("chai")
const { ethers, upgrades} = require("hardhat")

describe("ONFT1155Upgradeable: ", function () {
    const chainId_A = 1
    const chainId_B = 2
    const uri = "www.onft1155.com"

    let owner, warlock, lzEndpointMockA, lzEndpointMockB
    let ONFT_A, ONFT_B, LZEndpointMock, ONFT1155, ERC1155Src

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT1155 = await ethers.getContractFactory("ExampleONFT1155Upgradeable")
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
        lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)

        ONFT_A = await upgrades.deployProxy(ONFT1155, [uri, lzEndpointMockA.address, 10])
        ONFT_B = await upgrades.deployProxy(ONFT1155, [uri, lzEndpointMockB.address, 0])

        // wire the lz endpoints to guide msgs back and forth
        lzEndpointMockA.setDestLzEndpoint(ONFT_B.address, lzEndpointMockB.address)
        lzEndpointMockB.setDestLzEndpoint(ONFT_A.address, lzEndpointMockA.address)

        // set each contracts source address so it can send to each other
        await ONFT_A.setTrustedRemote(chainId_B, ethers.utils.solidityPack(["address", "address"], [ONFT_B.address, ONFT_A.address]))
        await ONFT_B.setTrustedRemote(chainId_A, ethers.utils.solidityPack(["address", "address"], [ONFT_A.address, ONFT_B.address]))
    })

    it("sendFrom()", async function () {
        const tokenId = 1
        const amount = 10
        // verify the owner owns tokens
        expect(await ONFT_A.balanceOf(owner.address, tokenId)).to.be.equal(amount)

        // token doesn't exist on other chain
        expect(await ONFT_B.balanceOf(owner.address, tokenId)).to.be.equal(0)

        // can transfer token on srcChain as regular erC1155
        await ONFT_A.safeTransferFrom(owner.address, warlock.address, tokenId, amount, "0x")
        expect(await ONFT_A.balanceOf(warlock.address, tokenId)).to.be.equal(amount)
        expect(await ONFT_A.balanceOf(owner.address, tokenId)).to.be.equal(0)

        // estimate nativeFees
        let nativeFee = (await ONFT_A.estimateSendFee(chainId_B, warlock.address, tokenId, amount, false, "0x")).nativeFee

        // swaps token to other chain
        await ONFT_A.connect(warlock).sendFrom(
            warlock.address,
            chainId_B,
            warlock.address,
            tokenId,
            amount,
            warlock.address,
            ethers.constants.AddressZero,
            "0x",
            { value: nativeFee }
        )

        // no tokens on src chain
        expect(await ONFT_A.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // token received on the dst chain
        expect(await ONFT_B.balanceOf(warlock.address, tokenId)).to.be.equal(amount)
    })

    it("sendFrom() - reverts if from is not msgSender", async function () {
        const tokenId = 1
        const amount = 10

        // swaps token to other chain
        await expect(
            ONFT_A.connect(warlock).sendFrom(
                owner.address,
                chainId_B,
                owner.address,
                tokenId,
                amount,
                owner.address,
                ethers.constants.AddressZero,
                "0x"
            )
        ).to.be.revertedWith("ONFT1155: send caller is not owner nor approved")
    })

    it("sendFrom() - on non proxy", async function () {
        const tokenId = 1
        const amount = 10

        // estimate nativeFees
        let nativeFee = (await ONFT_A.estimateSendFee(chainId_B, owner.address, tokenId, amount, false, "0x")).nativeFee

        // swaps token to other chain
        await ONFT_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, amount, owner.address, ethers.constants.AddressZero, "0x", {
            value: nativeFee,
        })

        // token received on the dst chain
        expect(await ONFT_B.balanceOf(owner.address, tokenId)).to.be.equal(amount)

        // approve the other user to send the token
        await ONFT_B.setApprovalForAll(warlock.address, tokenId)

        // estimate nativeFees
        nativeFee = (await ONFT_B.estimateSendFee(chainId_A, warlock.address, tokenId, amount, false, "0x")).nativeFee

        // sends across
        await ONFT_B.connect(warlock).sendFrom(
            owner.address,
            chainId_A,
            warlock.address,
            tokenId,
            amount,
            warlock.address,
            ethers.constants.AddressZero,
            "0x",
            { value: nativeFee }
        )

        // token received on the dst chain
        expect(await ONFT_A.balanceOf(warlock.address, tokenId)).to.be.equal(amount)
    })

    it("sendBatchFrom()", async function () {
        const tokenIds = [123, 456, 7890, 101112131415]
        const amounts = [1, 33, 22, 1234566]
        const emptyAmounts = [0, 0, 0, 0]
        const listOfOwner = tokenIds.map((x) => owner.address)
        const listOfWarlock = tokenIds.map((x) => warlock.address)
        const listOfONFT_A = tokenIds.map((x) => ONFT_A.address)

        function checkTokenBalance(balances, expectedBalances) {
            expect(balances.length).to.equal(expectedBalances.length)
            for (let i = 0; i < balances.length; i++) {
                expect(balances[i].toNumber()).to.equal(expectedBalances[i])
            }
        }

        // mint large batch of tokens
        await ONFT_A.mintBatch(owner.address, tokenIds, amounts)

        // verify the owner owns tokens
        checkTokenBalance(await ONFT_A.balanceOfBatch(listOfOwner, tokenIds), amounts)

        // tokens don't exist on other chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfOwner, tokenIds), emptyAmounts)

        // can transfer tokens on srcChain as regular erC1155
        await ONFT_A.safeBatchTransferFrom(owner.address, warlock.address, tokenIds, amounts, "0x")
        checkTokenBalance(await ONFT_A.balanceOfBatch(listOfWarlock, tokenIds), amounts)
        checkTokenBalance(await ONFT_A.balanceOfBatch(listOfOwner, tokenIds), emptyAmounts)

        // estimate nativeFees
        let nativeFee = (await ONFT_A.estimateSendBatchFee(chainId_B, warlock.address, tokenIds.slice(1), amounts.slice(1), false, "0x")).nativeFee

        // swaps tokens to other chain in seperate batches
        await ONFT_A.connect(warlock).sendBatchFrom(
            warlock.address,
            chainId_B,
            warlock.address,
            tokenIds.slice(1),
            amounts.slice(1),
            warlock.address,
            ethers.constants.AddressZero,
            "0x",
            { value: nativeFee }
        )

        // estimate nativeFees
        nativeFee = (await ONFT_A.estimateSendBatchFee(chainId_B, warlock.address, tokenIds.slice(0, 1), amounts.slice(0, 1), false, "0x")).nativeFee

        await ONFT_A.connect(warlock).sendBatchFrom(
            warlock.address,
            chainId_B,
            warlock.address,
            tokenIds.slice(0, 1),
            amounts.slice(0, 1),
            warlock.address,
            ethers.constants.AddressZero,
            "0x",
            { value: nativeFee }
        )

        // no tokens on the src chain
        checkTokenBalance(await ONFT_A.balanceOfBatch(listOfWarlock, tokenIds), emptyAmounts)

        // tokens received on the dst chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfWarlock, tokenIds), amounts)

        // estimate nativeFees
        nativeFee = (await ONFT_B.estimateSendBatchFee(chainId_A, owner.address, tokenIds, amounts, false, "0x")).nativeFee

        // can send to other onft contract eg. not the original nft contract chain, and a different address
        // eg. warlock -> owner
        await ONFT_B.connect(warlock).sendBatchFrom(
            warlock.address,
            chainId_A,
            owner.address,
            tokenIds,
            amounts,
            warlock.address,
            ethers.constants.AddressZero,
            "0x",
            { value: nativeFee }
        )

        // tokens are burned on the sending chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfWarlock, tokenIds), emptyAmounts)

        // tokens received on the dst chain
        checkTokenBalance(await ONFT_A.balanceOfBatch(listOfOwner, tokenIds), amounts)

        // estimate nativeFees
        nativeFee = (await ONFT_A.estimateSendBatchFee(chainId_A, warlock.address, tokenIds, amounts, false, "0x")).nativeFee

        // send it back to the original chain, and original owner
        await ONFT_A.sendBatchFrom(
            owner.address,
            chainId_B,
            warlock.address,
            tokenIds,
            amounts,
            warlock.address,
            ethers.constants.AddressZero,
            "0x",
            { value: nativeFee }
        )

        // tokens are burned on the sending chain
        checkTokenBalance(await ONFT_A.balanceOfBatch(listOfWarlock, tokenIds), emptyAmounts)

        // is received on the original chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfWarlock, tokenIds), amounts)
    })

    it("sendBatch() - reverts if not approved", async function () {
        const tokenIds = [123, 456, 7890, 101112131415]
        const amounts = [1, 33, 22, 1234566]
        await ONFT_A.mintBatch(owner.address, tokenIds, amounts)

        await expect(
            ONFT_A.connect(warlock).sendBatchFrom(
                owner.address,
                chainId_B,
                warlock.address,
                tokenIds,
                amounts,
                warlock.address,
                ethers.constants.AddressZero,
                "0x"
            )
        ).to.be.revertedWith("ONFT1155: send caller is not owner nor approved")
    })

    it("sendBatch() - reverts if mismatched amounts and tokenIds", async function () {
        const tokenIds = [123, 456, 7890, 101112131415]
        const amounts = [1, 33, 22, 44]
        await ONFT_A.mintBatch(owner.address, tokenIds, amounts)

        // mismatch the length of ids and amounts
        await expect(
            ONFT_A.connect(warlock).sendBatchFrom(
                warlock.address,
                chainId_B,
                warlock.address,
                tokenIds.slice(1),
                amounts,
                warlock.address,
                ethers.constants.AddressZero,
                "0x"
            )
        ).to.be.revertedWith("ERC1155: ids and amounts length mismatch'")
    })

    it("estimateSendFee()", async function () {
        const tokenId = 123
        const amount = 11
        const nativeFee = 123
        const zroFee = 666

        // mint large batch of tokens
        await ONFT_A.mint(warlock.address, tokenId, amount)

        // estimate the fees
        const fees = await ONFT_A.estimateSendFee(chainId_B, warlock.address, tokenId, amount, false, "0x")

        // reverts with not enough native
        await expect(
            ONFT_A.connect(warlock).sendFrom(
                warlock.address,
                chainId_B,
                warlock.address,
                tokenId,
                amount,
                warlock.address,
                ethers.constants.AddressZero,
                "0x",
                {
                    value: fees.nativeFee.sub(1),
                }
            )
        ).to.be.reverted

        // does not revert with correct amount
        await expect(
            ONFT_A.connect(warlock).sendFrom(
                warlock.address,
                chainId_B,
                warlock.address,
                tokenId,
                amount,
                warlock.address,
                ethers.constants.AddressZero,
                "0x",
                {
                    value: fees.nativeFee,
                }
            )
        ).to.not.reverted
    })

    it("estimateSendBatchFee()", async function () {
        const tokenIds = [123, 456, 7890, 101112131415]
        const amounts = [1, 33, 22, 1234566]
        const nativeFee = 123
        const zroFee = 666

        // mint large batch of tokens
        await ONFT_A.mintBatch(warlock.address, tokenIds, amounts)

        // estimate the fees
        const fees = await ONFT_A.estimateSendBatchFee(chainId_B, warlock.address, tokenIds, amounts, false, "0x")

        // reverts with not enough native
        await expect(
            ONFT_A.connect(warlock).sendBatchFrom(
                warlock.address,
                chainId_B,
                warlock.address,
                tokenIds,
                amounts,
                warlock.address,
                ethers.constants.AddressZero,
                "0x",
                { value: fees.nativeFee.sub(1) }
            )
        ).to.be.reverted

        // does not revert with correct amount
        await expect(
            ONFT_A.connect(warlock).sendBatchFrom(
                warlock.address,
                chainId_B,
                warlock.address,
                tokenIds,
                amounts,
                warlock.address,
                ethers.constants.AddressZero,
                "0x",
                { value: fees.nativeFee }
            )
        ).to.not.reverted
    })
})
