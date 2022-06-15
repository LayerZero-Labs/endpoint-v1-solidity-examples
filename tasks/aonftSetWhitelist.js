module.exports = async function (taskArgs, hre) {
  const advancedONFT = await ethers.getContract("AdvancedONFT721")
  console.log(`[source] AdvancedONFT721.address: ${advancedONFT.address}`)

  const wl = ["0x5509feB29Cf44A32D72aec2Fbad8e8A574347D0e"]
  // added a list of addresses to Wl
  try {
      let tx1 = await (await advancedONFT.setAllowList(wl)).wait()
      console.log(`✅ [${hre.network.name}] setAllowList(wl)`)
      console.log(` tx1: ${tx1.transactionHash}`)
  } catch (e) {
      console.log(e)
  }
}