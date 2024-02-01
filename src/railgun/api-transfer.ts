import {
    TXIDVersion,
    NetworkName,
    TransactionGasDetails,
    RailgunERC20AmountRecipient,
    EVMGasType,
    calculateGasPrice,
  } from '@railgun-community/shared-models';
import {
  gasEstimateForUnprovenTransfer,
  generateTransferProof,
  populateProvedTransfer
} from '@railgun-community/wallet';
import axios from 'axios';
import config from '../config';
import * as Railgun from './railgun';
import constants from '../constants';
import { Optional } from './engine';
import { InfuraProvider, Wallet, parseUnits } from 'ethers';

async function sendTransfer() {
  const railgunAddress = '0zk1qyql93qvzye2893gta6y5ha7vq5g25ctnkvnf9mlwjk34pett5utfrv7j6fe3z53lu72huwn80vy3pqt9zrpcuxncuc2tr9p3mv2jtqxkp4hawccfp832zhs6cz';

  // Optional encrypted memo text only readable by the sender and receiver.
  // May include text and emojis. See "Private Transfers" page for details.
  const memoText = 'Private transfer from Alice to Charlie';

  // Formatted token amounts to transfer.
  const erc20AmountRecipients: RailgunERC20AmountRecipient[] = [
    {
      tokenAddress: constants.TOKENS.AMANA,
      amount: 17n, // hexadecimal amount equivalent to 16
      recipientAddress: railgunAddress,
    },
  ];

  const sendWithPublicWallet = true; // False if sending with Relayer. True if self-signing with public wallet. See "UX: Private Transactions".

  const originalGasEstimate = 0n; // Always 0, we don't have this yet.
  
  const evmGasType = EVMGasType.Type2;
  // const maxFeePerGas = parseUnits('100', 'gwei');
  // const maxPriorityFeePerGas = parseUnits('50', 'gwei');
  const maxFeePerGas = parseUnits('0', 'gwei');
  const maxPriorityFeePerGas = parseUnits('0', 'gwei');

  const originalGasDetails: TransactionGasDetails = {
    evmGasType, 
    gasEstimate: originalGasEstimate,
    maxFeePerGas,
    maxPriorityFeePerGas
  };

  Railgun.initializeEngine();
  await Railgun.loadEngineProvider();
  Railgun.setEngineLoggers();

  const railgunWalletInfo = await Railgun.createWallet(config.encryptionKey, config.mnemonic, Railgun.creationBlockNumberMap);
  console.log(railgunWalletInfo);
  // Need to refresh balances, or wallet may try to spend already spent UTXOs.
  await Railgun.refreshBalances(Railgun.chain, undefined);
 
  const railgunWalletID = railgunWalletInfo.id;

  const { gasEstimate } = await gasEstimateForUnprovenTransfer(
    TXIDVersion.V2_PoseidonMerkle,
    NetworkName.Polygon,
    railgunWalletID,
    config.encryptionKey,
    memoText,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    originalGasDetails,
    undefined,
    sendWithPublicWallet,
  );

  const transactionGasDetails: TransactionGasDetails = {
    evmGasType, 
    gasEstimate,
    maxFeePerGas,
    maxPriorityFeePerGas
  };

  // ONLY required for transactions that are using a Relayer. Can leave undefined if self-signing.
  const overallBatchMinGasPrice: Optional<bigint> = await calculateGasPrice(transactionGasDetails);

  const progressCallback = (progress: number) => {
    console.log(`Transfer proof progress: ${progress}`)
    // Handle proof progress (show in UI).
    // Proofs can take 20-30 seconds on slower devices.
  };
  
  const showSenderAddressToRecipient: boolean = false; // Allow recipient to see RAILGUN address of sender

  await generateTransferProof(
    TXIDVersion.V2_PoseidonMerkle,
    NetworkName.Polygon,
    railgunWalletID,
    config.encryptionKey,
    showSenderAddressToRecipient,
    memoText,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    undefined, // relayerFeeERC20AmountRecipient
    sendWithPublicWallet,
    undefined, // overallBatchMinGasPrice
    progressCallback,
  );

  const populateResponse = await populateProvedTransfer(
    TXIDVersion.V2_PoseidonMerkle,
    NetworkName.Polygon,
    railgunWalletID,
    showSenderAddressToRecipient,
    memoText,
    erc20AmountRecipients,
    [], // nftAmountRecipients
    undefined,//relayerFeeERC20AmountRecipient,
    sendWithPublicWallet,
    undefined,//overallBatchMinGasPrice,
    transactionGasDetails,
  );



  const { transaction } = populateResponse;


  console.log('typeof transaction');
  console.log(typeof transaction);
  console.log('transaction');
  console.log(transaction);

  axios({
    method: 'post',
    url: 'http://localhost/submit-transaction',
    data: {
      transaction: {
        to: transaction.to,
        data: transaction.data,
        gasLimit: transaction.gasLimit?.toString(),
        type: transaction.type,
        maxFeePerGas: transaction.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString(),
      },
    }
  });
}

sendTransfer().catch(console.error);