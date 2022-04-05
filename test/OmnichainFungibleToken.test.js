const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OmnichainFungibleToken", function () {
    beforeEach(async function () {
        this.accounts = await ethers.getSigners();
        this.owner = this.accounts[0];

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock");
        const OmnichainFungibleToken = await ethers.getContractFactory("OmnichainFungibleToken");

        this.chainIdSrc = 1;
        this.chainIdDst = 2;

        this.lzEndpointSrcMock = await LZEndpointMock.deploy(this.chainIdSrc);
        this.lzEndpointDstMock = await LZEndpointMock.deploy(this.chainIdDst);

        this.initialSupplyOnEndpoint = ethers.utils.parseUnits("1000000", 18)

        // create two OmnichainFungibleToken instances
        this.OmnichainFungibleTokenSrc = await OmnichainFungibleToken.deploy(
            "NAME1",
            "SYM1",
            this.lzEndpointSrcMock.address,
            this.chainIdSrc,
            this.initialSupplyOnEndpoint
        );
        this.OmnichainFungibleTokenDst = await OmnichainFungibleToken.deploy(
            "NAME2",
            "SYM2",
            this.lzEndpointDstMock.address,
            this.chainIdSrc,
            0
        );

        this.lzEndpointSrcMock.setDestLzEndpoint(this.OmnichainFungibleTokenDst.address, this.lzEndpointDstMock.address)
        this.lzEndpointDstMock.setDestLzEndpoint(this.OmnichainFungibleTokenSrc.address, this.lzEndpointSrcMock.address)

        // set each contracts remote address so it can send to each other
        await this.OmnichainFungibleTokenSrc.setDestination(this.chainIdDst, this.OmnichainFungibleTokenDst.address) // for A, set B
        await this.OmnichainFungibleTokenDst.setDestination(this.chainIdSrc, this.OmnichainFungibleTokenSrc.address) // for B, set A

        // retrieve the starting tokens
        this.startingTokens = await this.OmnichainFungibleTokenSrc.balanceOf(this.owner.address);
    });

    it("burn local tokens on source chain and mint on destination chain", async function () {
        // ensure they're both starting from 1000000
        let a = await this.OmnichainFungibleTokenSrc.balanceOf(this.owner.address);
        let b = await this.OmnichainFungibleTokenDst.balanceOf(this.owner.address);
        expect(a).to.be.equal(this.startingTokens);
        expect(b).to.be.equal("0x0");

        // approve and send tokens
        let sendQty = ethers.utils.parseUnits("100", 18)
        await this.OmnichainFungibleTokenSrc.approve(this.OmnichainFungibleTokenSrc.address, sendQty);
        await this.OmnichainFungibleTokenSrc.sendTokens(
            this.chainIdDst,
            this.owner.address,
            sendQty,
            ethers.constants.AddressZero,
            0
        )

        // verify tokens burned on source chain and minted on destination chain
        a = await this.OmnichainFungibleTokenSrc.balanceOf(this.owner.address);
        b = await this.OmnichainFungibleTokenDst.balanceOf(this.owner.address);
        expect(a).to.be.equal(this.startingTokens.sub(sendQty));
        expect(b).to.be.equal(sendQty);
    });
});


