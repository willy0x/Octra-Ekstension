import { ExtensionStorageManager } from './extensionStorage';
import { verifyPassword, decryptWalletData } from './password';
import { Wallet } from '../types/wallet';

export class WalletManager {
  static async unlockWallets(password: string): Promise<Wallet[]> {
    try {
      console.log('🔓 WalletManager: Starting unlock process...');
      
      // Get password hash and salt
      const hashedPassword = await ExtensionStorageManager.get('walletPasswordHash');
      const salt = await ExtensionStorageManager.get('walletPasswordSalt');
      
      if (!hashedPassword || !salt) {
        throw new Error('No password set');
      }

      // Verify password
      const isValid = await verifyPassword(password, hashedPassword, salt);
      
      if (!isValid) {
        throw new Error('Invalid password');
      }

      console.log('✅ WalletManager: Password verified successfully');

      // Get encrypted wallets
      const encryptedWallets = await ExtensionStorageManager.get('encryptedWallets');
      const decryptedWallets: Wallet[] = [];

      if (encryptedWallets) {
        try {
          // Safe parsing - handle both string and object
          let parsedEncrypted: any[];
          if (typeof encryptedWallets === 'string') {
            parsedEncrypted = JSON.parse(encryptedWallets);
          } else if (Array.isArray(encryptedWallets)) {
            parsedEncrypted = encryptedWallets;
          } else {
            throw new Error('Invalid encrypted wallets format');
          }
          
          console.log(`🔍 WalletManager: Found ${parsedEncrypted.length} encrypted wallets to decrypt`);
          
          // Decrypt all wallets
          for (const encryptedWallet of parsedEncrypted) {
            try {
              const decryptedData = await decryptWalletData(encryptedWallet.encryptedData, password);
              const wallet = JSON.parse(decryptedData);
              decryptedWallets.push(wallet);
              console.log(`✅ WalletManager: Successfully decrypted wallet ${wallet.address.slice(0, 8)}...`);
            } catch (error) {
              console.error('❌ WalletManager: Failed to decrypt wallet:', encryptedWallet.address, error);
              // Continue with other wallets instead of failing completely
            }
          }
        } catch (error) {
          console.error('❌ WalletManager: Failed to parse encrypted wallets:', error);
          throw new Error('Failed to parse encrypted wallet data');
        }
      } else {
        // If no encrypted wallets found, check if there are unencrypted wallets in storage
        // This handles the case where wallets exist but aren't encrypted yet
        const existingWallets = await ExtensionStorageManager.get('wallets');
        if (existingWallets) {
          try {
            const parsedWallets = JSON.parse(existingWallets);
            if (Array.isArray(parsedWallets) && parsedWallets.length > 0) {
              decryptedWallets.push(...parsedWallets);
              console.log(`📦 WalletManager: Found ${parsedWallets.length} existing unencrypted wallets`);
            }
          } catch (error) {
            console.error('❌ WalletManager: Failed to parse existing wallets:', error);
          }
        }
      }

      console.log(`🎯 WalletManager: Total wallets after decryption: ${decryptedWallets.length}`);

      if (decryptedWallets.length === 0) {
        console.warn('⚠️ WalletManager: No wallets found after unlock process');
        // Don't throw error, just return empty array - let the app handle empty state
      }

      // Update storage atomically - ensure all wallets are preserved
      await Promise.all([
        ExtensionStorageManager.set('wallets', JSON.stringify(decryptedWallets)),
        ExtensionStorageManager.set('isWalletLocked', 'false')
      ]);
      
      console.log('💾 WalletManager: Wallet data saved to storage successfully');
      
      // Set active wallet - preserve existing activeWalletId if valid, otherwise use first wallet
      if (decryptedWallets.length > 0) {
        const activeWalletId = await ExtensionStorageManager.get('activeWalletId');
        
        // Check if the stored activeWalletId still exists in decrypted wallets
        if (activeWalletId) {
          const walletExists = decryptedWallets.some(wallet => wallet.address === activeWalletId);
          if (walletExists) {
            console.log(`🎯 WalletManager: Preserving existing active wallet: ${activeWalletId.slice(0, 8)}...`);
            // Keep the existing activeWalletId - no need to update
          } else {
            // If stored wallet doesn't exist anymore, use first wallet
            await ExtensionStorageManager.set('activeWalletId', decryptedWallets[0].address);
            console.log(`🔄 WalletManager: Active wallet not found, switching to first wallet: ${decryptedWallets[0].address.slice(0, 8)}...`);
          }
        } else {
          // No activeWalletId set, use first wallet
          await ExtensionStorageManager.set('activeWalletId', decryptedWallets[0].address);
          console.log(`🆕 WalletManager: No active wallet set, using first wallet: ${decryptedWallets[0].address.slice(0, 8)}...`);
        }
      }

      console.log(`🎉 WalletManager: Unlock completed successfully with ${decryptedWallets.length} wallets`);
      return decryptedWallets;
    } catch (error) {
      console.error('❌ WalletManager unlock error:', error);
      throw error;
    }
  }

  static async lockWallets(): Promise<void> {
    try {
      // Clear wallet data but preserve activeWalletId for unlock restoration
      await Promise.all([
        ExtensionStorageManager.remove('wallets'),
        ExtensionStorageManager.set('isWalletLocked', 'true')
      ]);
      
      console.log('🔒 WalletManager: Wallets locked successfully (activeWalletId preserved)');
    } catch (error) {
      console.error('WalletManager lock error:', error);
      throw error;
    }
  }

  static async isWalletSetup(): Promise<boolean> {
    try {
      const hasPassword = await ExtensionStorageManager.get('walletPasswordHash');
      return !!hasPassword;
    } catch (error) {
      console.error('Failed to check wallet setup:', error);
      return false;
    }
  }

  static async shouldShowUnlockScreen(): Promise<boolean> {
    try {
      const [hasPassword, isLocked, hasWallets] = await Promise.all([
        ExtensionStorageManager.get('walletPasswordHash'),
        ExtensionStorageManager.get('isWalletLocked'),
        ExtensionStorageManager.get('wallets')
      ]);
      
      // If no password is set, never show unlock screen
      if (!hasPassword) {
        return false;
      }
      
      // If password is set and wallet is not explicitly unlocked, show unlock screen
      // OR if password is set but no decrypted wallets are available
      return isLocked !== 'false' || !hasWallets;
    } catch (error) {
      console.error('Failed to check unlock status:', error);
      return false;
    }
  }

  static async isWalletLocked(): Promise<boolean> {
    try {
      const [hasPassword, isLocked] = await Promise.all([
        ExtensionStorageManager.get('walletPasswordHash'),
        ExtensionStorageManager.get('isWalletLocked')
      ]);
      
      // If no password, never locked
      if (!hasPassword) {
        return false;
      }
      
      // If password exists, locked unless explicitly unlocked
      return isLocked !== 'false';
    } catch (error) {
      console.error('Failed to check lock status:', error);
      return false;
    }
  }
}