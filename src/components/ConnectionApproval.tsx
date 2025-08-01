import React, { useState } from 'react';
import { DAppConnection } from './DAppConnection';
import { Wallet } from '../types/wallet';

interface ConnectionApprovalProps {
  request: {
    origin: string;
    appName: string;
    appIcon: string;
    permissions: string[];
  };
  wallet: Wallet;
  onApprove: (approved: boolean, selectedAddress?: string) => void;
}

export function ConnectionApproval({ request, wallet, onApprove }: ConnectionApprovalProps) {
  const [selectedWallet, setSelectedWallet] = useState<Wallet>(wallet);

  // Convert request to DAppConnectionRequest format
  const connectionRequest = {
    origin: request.origin,
    appName: request.appName,
    appIcon: request.appIcon,
    permissions: request.permissions
  };

  const handleApprove = (wallet: Wallet) => {
    onApprove(true, wallet.address);
  };

  const handleReject = () => {
    onApprove(false);
  };

  return (
    <DAppConnection
      connectionRequest={connectionRequest}
      wallets={[wallet]}
      selectedWallet={selectedWallet}
      onWalletSelect={setSelectedWallet}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}