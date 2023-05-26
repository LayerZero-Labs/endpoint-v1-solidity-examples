const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants } = require("ethers")

describe.only("ProxyOFTV2PreCrimeView", function () {
	let precrimeA, proxyOftA, proxyOftViewA, proxyOftBytes32AddressA, token, endpointA
	let precrimeB, oftB, oftViewB, oftBytes32AddressB, endpointB
	let precrimeC, oftC, oftViewC, oftBytes32AddressC, endpointC
	let owner, ownerBytes32Address

	const chainIdA = 1
	const chainIdB = 2
	const chainIdC = 3
	const sharedDecimals = 6
	const maxBatchSize = 100000
	const globalSupply = utils.parseEther("1000")
	const sendPacketType = 0;

	const CODE_SUCCESS = 0
	const CODE_PRECRIME_FAILURE = 1

	const createSendPayload = (amountSD) => utils.solidityPack(["uint8", "bytes32", "uint64"], [sendPacketType, ownerBytes32Address, amountSD])
	const decodeSimulationResult = (result) => {
		const data = utils.defaultAbiCoder.decode(["uint16", "bytes data"], result.data)
		return utils.defaultAbiCoder.decode(["uint256 chainTotalSupply", "bool"], data.data)
	}

	beforeEach(async function () {
		[owner] = await ethers.getSigners()
		ownerBytes32Address = utils.defaultAbiCoder.encode(["address"], [owner.address])

		const endpointFactory = await ethers.getContractFactory("LZEndpointMock")
		endpointA = await endpointFactory.deploy(chainIdA)
		endpointB = await endpointFactory.deploy(chainIdB)
		endpointC = await endpointFactory.deploy(chainIdC)

		const tokenFactory = await ethers.getContractFactory("ERC20Mock")
		token = await tokenFactory.deploy("ERC20", "ERC20")

		const proxyOftFactory = await ethers.getContractFactory("ProxyOFTV2")
		proxyOftA = await proxyOftFactory.deploy(token.address, sharedDecimals, endpointA.address)
		proxyOftBytes32AddressA = utils.defaultAbiCoder.encode(["address"], [proxyOftA.address])

		const proxyOftViewFactory = await ethers.getContractFactory("ProxyOFTV2View")
		proxyOftViewA = await proxyOftViewFactory.deploy(proxyOftA.address)

		const oftFactory = await ethers.getContractFactory("OFTV2")
		oftB = await oftFactory.deploy("OFT", "OFT", sharedDecimals, endpointB.address)
		oftBytes32AddressB = utils.defaultAbiCoder.encode(["address"], [oftB.address])

		oftC = await oftFactory.deploy("OFT", "OFT", sharedDecimals, endpointC.address)
		oftBytes32AddressC = utils.defaultAbiCoder.encode(["address"], [oftC.address])

		const oftViewFactory = await ethers.getContractFactory("OFTV2View")
		oftViewB = await oftViewFactory.deploy(oftB.address)
		oftViewC = await oftViewFactory.deploy(oftC.address)

		const precrimeFactory = await ethers.getContractFactory("ProxyOFTV2PreCrimeView")
		precrimeA = await precrimeFactory.deploy(chainIdA, proxyOftViewA.address, maxBatchSize)
		precrimeB = await precrimeFactory.deploy(chainIdB, oftViewB.address, maxBatchSize)
		precrimeC = await precrimeFactory.deploy(chainIdC, oftViewC.address, maxBatchSize)

		// internal bookkeeping for endpoints (not part of a real deploy, just for this test)
		await endpointA.setDestLzEndpoint(oftB.address, endpointB.address)
		await endpointA.setDestLzEndpoint(oftC.address, endpointC.address)
		await endpointB.setDestLzEndpoint(proxyOftA.address, endpointA.address)
		await endpointB.setDestLzEndpoint(oftC.address, endpointC.address)
		await endpointC.setDestLzEndpoint(proxyOftA.address, endpointA.address)
		await endpointC.setDestLzEndpoint(oftB.address, endpointB.address)

		await proxyOftA.setTrustedRemoteAddress(chainIdB, oftB.address)
		await proxyOftA.setTrustedRemoteAddress(chainIdC, oftC.address)
		await oftB.setTrustedRemoteAddress(chainIdA, proxyOftA.address)
		await oftB.setTrustedRemoteAddress(chainIdC, oftC.address)
		await oftC.setTrustedRemoteAddress(chainIdA, proxyOftA.address)
		await oftC.setTrustedRemoteAddress(chainIdB, oftB.address)

		const precrimeBytes32AddressA = utils.defaultAbiCoder.encode(["address"], [precrimeA.address])
		const precrimeBytes32AddressB = utils.defaultAbiCoder.encode(["address"], [precrimeB.address])
		const precrimeBytes32AddressC = utils.defaultAbiCoder.encode(["address"], [precrimeC.address])
		precrimeA.setRemotePrecrimeAddresses([chainIdB, chainIdC], [precrimeBytes32AddressB, precrimeBytes32AddressC])
		precrimeB.setRemotePrecrimeAddresses([chainIdA, chainIdC], [precrimeBytes32AddressA, precrimeBytes32AddressC])
		precrimeC.setRemotePrecrimeAddresses([chainIdA, chainIdB], [precrimeBytes32AddressA, precrimeBytes32AddressB])

		await token.mint(owner.address, globalSupply)
		const sendAmountB = utils.parseEther("15")
		await token.approve(proxyOftA.address, sendAmountB)
		let nativeFee = (await proxyOftA.estimateSendFee(chainIdB, ownerBytes32Address, sendAmountB, false, "0x")).nativeFee

		await proxyOftA.sendFrom(
			owner.address,
			chainIdB,
			ownerBytes32Address,
			sendAmountB,
			[owner.address, ethers.constants.AddressZero, "0x"],
			{ value: nativeFee }
		)

		const sendAmountC = utils.parseEther("5")
		await token.approve(proxyOftA.address, sendAmountC)
		nativeFee = (await proxyOftA.estimateSendFee(chainIdC, ownerBytes32Address, sendAmountC, false, "0x")).nativeFee

		await proxyOftA.sendFrom(
			owner.address,
			chainIdC,
			ownerBytes32Address,
			sendAmountC,
			[owner.address, ethers.constants.AddressZero, "0x"],
			{ value: nativeFee }
		)
	})

	describe("simulate()", async function () {
		it("reverts when packet is not from trusted remote", async function () {
			const amountSD = utils.parseUnits("1", sharedDecimals)
			const packet = {
				srcChainId: chainIdB,
				srcAddress: ownerBytes32Address,
				nonce: 1,
				payload: createSendPayload(amountSD)
			}

			await expect(precrimeA.simulate([packet])).to.be.revertedWith("OFTV2View: not trusted remote")
		})

		it("reverts when transfer amount exceeds the amount locked in ProxyOFT", async function () {
			const amountSD = utils.parseUnits("21", sharedDecimals)
			const packet = {
				srcChainId: chainIdB,
				srcAddress: oftBytes32AddressB,
				nonce: 1,
				payload: createSendPayload(amountSD)
			}

			await expect(precrimeA.simulate([packet])).to.be.revertedWith("ProxyOFTV2View: transfer amount exceeds locked amount");
		})

		it("simulates ProxyOFT state change", async function () {
			const outboundAmount = await proxyOftA.outboundAmount()
			const amount = utils.parseEther("1")
			const amountSD = utils.parseUnits("1", sharedDecimals)
			const packet = {
				srcChainId: chainIdB,
				srcAddress: oftBytes32AddressB,
				nonce: 1,
				payload: createSendPayload(amountSD)
			}
			const result = await precrimeA.simulate([packet])
			const simulationResult = decodeSimulationResult(result)

			expect(simulationResult.chainTotalSupply).to.equal(outboundAmount.sub(amount))
		})

		it("simulates OFT state change", async function () {
			const totalSupply = await oftB.totalSupply()
			const amount = utils.parseEther("1")
			const amountSD = utils.parseUnits("1", sharedDecimals)
			const packet = {
				srcChainId: chainIdA,
				srcAddress: proxyOftBytes32AddressA,
				nonce: 2,
				payload: createSendPayload(amountSD)
			}
			const result = await precrimeB.simulate([packet])
			const simulationResult = decodeSimulationResult(result)

			expect(simulationResult.chainTotalSupply).to.equal(totalSupply.add(amount))
		})
	})

	describe("precrime()", async function () {
		let packet
		beforeEach(async function () {
			const amountSD = utils.parseUnits("10", sharedDecimals)
			packet = {
				srcChainId: chainIdA,
				srcAddress: proxyOftBytes32AddressA,
				nonce: 1,
				payload: createSendPayload(amountSD)
			}
		})

		it("passes precrime check", async function () {
			let simulationResults = [
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("10"), true]),
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("8"), false]),
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("2"), false]),
			]

			simulationResults[0] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdA, simulationResults[0]])
			simulationResults[1] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdB, simulationResults[1]])
			simulationResults[2] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdC, simulationResults[2]])

			const [code,] = await precrimeA.precrime([packet], simulationResults)
			expect(code).to.eq(CODE_SUCCESS)
		})

		it("fails precrime check when more than one proxy simulation provided", async function () {
			let simulationResults = [				
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("10"), true]),
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("11"), false]),
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("1"), true])
			]
			
			simulationResults[0] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdA, simulationResults[0]])
			simulationResults[1] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdB, simulationResults[1]])
			simulationResults[2] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdC, simulationResults[2]])

			const [code, reason] = await precrimeA.precrime([packet], simulationResults)
			expect(code).to.eq(CODE_PRECRIME_FAILURE)
			expect(utils.toUtf8String(reason)).to.eq("more than one proxy simulation")
		})

		it("fails precrime check when total minted != total locked", async function () {
			let simulationResults = [
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("10"), true]),
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("5"), false]),
				utils.defaultAbiCoder.encode(["uint256", "bool"], [utils.parseEther("6"), false]),
			]

			simulationResults[0] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdA, simulationResults[0]])
			simulationResults[1] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdB, simulationResults[1]])
			simulationResults[2] = utils.defaultAbiCoder.encode(["uint16", "bytes"], [chainIdC, simulationResults[2]])

			const [code, reason] = await precrimeC.precrime([packet], simulationResults)
			expect(code).to.eq(CODE_PRECRIME_FAILURE)
			expect(utils.toUtf8String(reason)).to.eq("total minted != total locked")
		})
	})
})
