const shell = require('shelljs')
const environments = require("../constants/environments.json")

module.exports = async function (taskArgs) {
    const networks = environments[taskArgs.e];
    if(!taskArgs.e || networks.length === 0) {
        console.log(`Invalid environment argument: ${taskArgs.e}`)
    }

    //deploy proxy oft
    if(taskArgs.proxyContract !== undefined) {
        console.log(`deploying ${taskArgs.proxyContract} to chain ${taskArgs.proxyChain}`)
        const deployProxyCommand = `npx hardhat --network ${taskArgs.proxyChain} deploy --tags ${taskArgs.proxyContract}`;
        console.log("deployProxyCommand: " + deployProxyCommand)
        shell.exec(deployProxyCommand)
    }

    //deploy oft's
    networks.map(async (network) => {
        if(network !== taskArgs.proxyChain) {
            console.log(`deploying ${taskArgs.contract} to chain ${network}`)
            const deployCommand = `npx hardhat --network ${network} deploy --tags ${taskArgs.contract}`;
            console.log("deployCommand: " + deployCommand)
            shell.exec(deployCommand)
        }
    })

    //wire
    networks.map(async (source) => {
        let srcContract, dstContract
        networks.map(async (destination) => {
            if(source !== destination) {
                if(taskArgs.proxyChain) {
                    if(source === taskArgs.proxyChain) {
                        srcContract = taskArgs.proxyContract;
                        dstContract = taskArgs.contract;
                    } else if(destination === taskArgs.proxyChain) {
                        srcContract = taskArgs.contract;
                        dstContract = taskArgs.proxyContract;
                    } else {
                        srcContract = taskArgs.contract;
                        dstContract = taskArgs.contract;
                    }
                }
                else {
                    srcContract = taskArgs.contract;
                    dstContract = taskArgs.contract;
                }
                const wireUpCommand = `npx hardhat --network ${source} setTrustedRemote --target-network ${destination} --src-contract ${srcContract} --dst-contract ${dstContract}`;
                console.log("wireUpCommand: " + wireUpCommand)
                shell.exec(wireUpCommand)
            }
        })
    })

    //check
    let checkWireUpCommand;
    if(taskArgs.proxyChain === undefined) {
        checkWireUpCommand = `npx hardhat checkWireUpAll --e ${taskArgs.e} --contract ${taskArgs.contract}`;
    } else {
        checkWireUpCommand = `npx hardhat checkWireUpAll --e ${taskArgs.e} --contract ${taskArgs.contract} --proxy-chain ${taskArgs.proxyChain} --proxy-contract ${taskArgs.proxyContract}`;
    }
    console.log("checkWireUpCommand: " + checkWireUpCommand)
    shell.exec(checkWireUpCommand)

    //print addresses
    let getAddressesCommand;
    if(taskArgs.proxyChain !== undefined) {
        getAddressesCommand = `node utils/getAddresses ${taskArgs.e} ${taskArgs.proxyContract},${taskArgs.contract}`;
    } else {
        getAddressesCommand = `node utils/getAddresses ${taskArgs.e} ${taskArgs.contract}`;
    }
    console.log("getAddressesCommand: " + getAddressesCommand)
    shell.exec(getAddressesCommand)
}