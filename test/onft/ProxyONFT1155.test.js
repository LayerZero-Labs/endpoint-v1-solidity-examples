const { expect } = require("chai")
const { ethers } = require("hardhat")

describe.only("ProxyONFT1155: ", function () {
    const chainId_A = 1
    const chainId_B = 2
    const chainId_C = 3
    const uri = "www.warlock.com"

    let owner, warlock, lzEndpointMockA, lzEndpointMockB, lzEndpointMockC
    let ONFT_B, ONFT_C, LZEndpointMock, ONFT, ERC1155, ERC1155Src, ProxyONFT_A, ProxyONFT

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ONFT = await ethers.getContractFactory("ONFT1155")
        ProxyONFT = await ethers.getContractFactory("ProxyONFT1155")
        ERC1155 = await ethers.getContractFactory("ERC1155Mock")
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
        lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)
        lzEndpointMockC = await LZEndpointMock.deploy(chainId_C)

        // make an ERC1155 to mock a previous deploy
        ERC1155Src = await ERC1155.deploy(uri)
        // // generate a proxy to allow it to go ONFT
        ProxyONFT_A = await ProxyONFT.deploy(lzEndpointMockA.address, ERC1155Src.address)

        // create ONFT on dstChains
        ONFT_B = await ONFT.deploy(uri, lzEndpointMockB.address)
        ONFT_C = await ONFT.deploy(uri, lzEndpointMockC.address)

        // wire the lz endpoints to guide msgs back and forth
        lzEndpointMockA.setDestLzEndpoint(ONFT_B.address, lzEndpointMockB.address)
        lzEndpointMockA.setDestLzEndpoint(ONFT_C.address, lzEndpointMockC.address)
        lzEndpointMockB.setDestLzEndpoint(ProxyONFT_A.address, lzEndpointMockA.address)
        lzEndpointMockB.setDestLzEndpoint(ONFT_C.address, lzEndpointMockC.address)
        lzEndpointMockC.setDestLzEndpoint(ProxyONFT_A.address, lzEndpointMockA.address)
        lzEndpointMockC.setDestLzEndpoint(ONFT_B.address, lzEndpointMockB.address)

        // set each contracts source address so it can send to each other
        await ProxyONFT_A.setTrustedRemote(chainId_B, ONFT_B.address)
        await ProxyONFT_A.setTrustedRemote(chainId_C, ONFT_C.address)
        await ONFT_B.setTrustedRemote(chainId_A, ProxyONFT_A.address)
        await ONFT_B.setTrustedRemote(chainId_C, ONFT_C.address)
        await ONFT_C.setTrustedRemote(chainId_A, ProxyONFT_A.address)
        await ONFT_C.setTrustedRemote(chainId_B, ONFT_B.address)
    })

    it("send()", async function () {
        const tokenId = 123
        const amount = 1
        await ERC1155Src.mint(owner.address, tokenId, amount)

        // verify the owner owns tokens
        expect(await ERC1155Src.balanceOf(owner.address, tokenId)).to.be.equal(amount)

        // token doesn't exist on other chain
        expect(await ONFT_B.balanceOf(owner.address, tokenId)).to.be.equal(0)

        // can transfer token on srcChain as regular erC1155
        await ERC1155Src.safeTransferFrom(owner.address, warlock.address, tokenId, amount, "0x")
        expect(await ERC1155Src.balanceOf(warlock.address, tokenId)).to.be.equal(amount)
        expect(await ERC1155Src.balanceOf(owner.address, tokenId)).to.be.equal(0)

        // approve the proxy to swap your token
        await ERC1155Src.connect(warlock).setApprovalForAll(ProxyONFT_A.address, true)

        // swaps token to other chain
        await ProxyONFT_A.connect(warlock).send(chainId_B, warlock.address, tokenId, amount, warlock.address, ethers.constants.AddressZero, "0x")

        // token is now owned by the proxy contract, because this is the original nft chain
        expect(await ERC1155Src.balanceOf(ProxyONFT_A.address, tokenId)).to.be.equal(amount)
        expect(await ERC1155Src.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // token received on the dst chain
        expect(await ONFT_B.balanceOf(warlock.address, tokenId)).to.be.equal(amount)

        // can send to other onft contract eg. not the original nft contract chain
        await ONFT_B.connect(warlock).send(chainId_C, warlock.address, tokenId, amount, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        expect(await ONFT_B.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // token received on the dst chain
        expect(await ONFT_C.balanceOf(warlock.address, tokenId)).to.be.equal(amount)

        // send it back to the original chain
        await ONFT_C.connect(warlock).send(chainId_A, warlock.address, tokenId, amount, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        expect(await ONFT_C.balanceOf(warlock.address, tokenId)).to.be.equal(0)

        // is received on the original chain
        expect(await ERC1155Src.balanceOf(warlock.address, tokenId)).to.be.equal(amount)

        // proxy no longer owns
        expect(await ERC1155Src.balanceOf(ProxyONFT_A.address, tokenId)).to.be.equal(0)
    })

    it("sendBatch()", async function () {
        const tokenIds = [123, 456, 7890, 101112131415]
        const amounts = [1, 33, 22, 1234566]
        const emptyAmounts = [0, 0, 0, 0]
        const listOfOwner = tokenIds.map(x => owner.address)
        const listOfWarlock = tokenIds.map(x => warlock.address)
        const listOfProxyA = tokenIds.map(x => ProxyONFT_A.address)

        function checkTokenBalance(balances, expectedBalances) {
            expect(balances.length).to.equal(expectedBalances.length)
            for (let i = 0; i < balances.length; i ++) {
                expect(balances[i].toNumber()).to.equal(expectedBalances[i])
            }
        }

        // mint large batch of tokens
        await ERC1155Src.mintBatch(owner.address, tokenIds, amounts)

        // verify the owner owns tokens
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfOwner, tokenIds), amounts)

        // tokens don't exist on other chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfOwner, tokenIds), emptyAmounts)

        // can transfer tokens on srcChain as regular erC1155
        await ERC1155Src.safeBatchTransferFrom(owner.address, warlock.address, tokenIds, amounts, "0x")
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfWarlock, tokenIds), amounts)
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfOwner, tokenIds), emptyAmounts)

        // approve the proxy to swap your tokens
        await ERC1155Src.connect(warlock).setApprovalForAll(ProxyONFT_A.address, true)

        // swaps tokens to other chain in seperate batches
        await ProxyONFT_A.connect(warlock).sendBatch(chainId_B, warlock.address, tokenIds.slice(1), amounts.slice(1), warlock.address, ethers.constants.AddressZero, "0x")
        await ProxyONFT_A.connect(warlock).sendBatch(chainId_B, warlock.address, tokenIds.slice(0, 1), amounts.slice(0, 1), warlock.address, ethers.constants.AddressZero, "0x")

        // tokens are now owned by the proxy contract, because this is the original nft chain
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfProxyA, tokenIds), amounts)
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfWarlock, tokenIds), emptyAmounts)

        // tokens received on the dst chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfWarlock, tokenIds), amounts)

        // can send to other onft contract eg. not the original nft contract chain, and a different address
        // eg. warlock -> owner
        await ONFT_B.connect(warlock).sendBatch(chainId_C, owner.address, tokenIds, amounts, warlock.address, ethers.constants.AddressZero, "0x")

        // tokens are burned on the sending chain
        checkTokenBalance(await ONFT_B.balanceOfBatch(listOfOwner, tokenIds), emptyAmounts)

        // tokens received on the dst chain
        checkTokenBalance(await ONFT_C.balanceOfBatch(listOfOwner, tokenIds), amounts)

        // send it back to the original chain, and original owner
        await ONFT_C.sendBatch(chainId_A, warlock.address, tokenIds, amounts, warlock.address, ethers.constants.AddressZero, "0x")

        // tokens are burned on the sending chain
        checkTokenBalance(await ONFT_C.balanceOfBatch(listOfWarlock, tokenIds), emptyAmounts)

        // is received on the original chain
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfWarlock, tokenIds), amounts)

        // proxy no longer owns
        checkTokenBalance(await ERC1155Src.balanceOfBatch(listOfProxyA, tokenIds), emptyAmounts)
    })
})