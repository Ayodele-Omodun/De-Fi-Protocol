/** @format */
const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("../scripts/getWeth");

// 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5

async function main() {
  await getWeth();
  const { deployer } = await getNamedAccounts();
  const lendingPool = await getLendingPool(deployer);
  console.log(`LendingPool address at ${lendingPool.address}`);

  // deposit
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  // aproval
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  console.log("depositing....");
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log("deposited");

  //borrow
  let { totalDebtETH, availableBorrowsETH } = await getUserData(
    lendingPool,
    deployer
  );
  const daiPrice = await getDaiPrice();
  const amountDaiToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());
  // 0.95 is used so that our users can only borrow 95 percent of what they are allowed to
  console.log(`You can borrow ${amountDaiToBorrow} DAI`);
  const amountDaiToBorrowInWei = ethers.utils
    .parseEther(amountDaiToBorrow.toString())
    .toString();
  const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  await borrowDai(daiAddress, lendingPool, amountDaiToBorrowInWei, deployer);
  await getUserData(lendingPool, deployer);

  //repay
  await repay(daiAddress, lendingPool, amountDaiToBorrowInWei, deployer);
  await getUserData(lendingPool, deployer);
}

async function repay(daiAddress, lendingPool, amount, account) {
  await approveErc20(daiAddress, lendingPool.address, amount, account);
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
  await repayTx.wait(1);
  console.log("Yay, you have repaid!!");
}

async function borrowDai(daiAddress, lendingPool, amount, account) {
  const borrowTx = await lendingPool.borrow(daiAddress, amount, 1, 0, account);
  await borrowTx.wait(1);
  console.log(`You have just borrowed ${amount}`);
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616E4d11A78F511299002da57A0a94577F1f4"
  );
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`The DAI/USD price is ${price.toString()}`);
  return price;
}

async function getUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);
  console.log(`You have ${totalCollateralETH} worth of ETH deposited`);
  console.log(`You have ${totalDebtETH} worth of ETH borrowed`);
  console.log(`You can borrow ${availableBorrowsETH} worth of ETH`);
  return { totalDebtETH, availableBorrowsETH };
}

async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );
  const lendingPoolAddress =
    await lendingPoolAddressesProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );
  return lendingPool;
}

async function approveErc20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20 = await ethers.getContractAt("IERC20", erc20Address, account);
  const tx = await erc20.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log("Approved!!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
