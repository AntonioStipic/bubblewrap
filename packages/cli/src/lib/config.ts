/*
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */


import {join} from 'path';
import {homedir} from 'os';
import {Config, Log, ConsoleLog, JdkInstaller, JdkHelper, AndroidSdkTools} from '@bubblewrap/core';
import {existsSync} from 'fs';
import {promises as fsPromises} from 'fs';
import {InquirerPrompt, Prompt} from './Prompt';

const DEFAULT_CONFIG_FOLDER = join(homedir(), '.bubblewrap');
const DEFAULT_CONFIG_NAME = 'config.json';
export const DEFAULT_CONFIG_FILE_PATH = join(DEFAULT_CONFIG_FOLDER, DEFAULT_CONFIG_NAME);
const LEGACY_CONFIG_FOLDER = join(homedir(), '.llama-pack');
const LEGACY_CONFIG_NAME = 'llama-pack-config.json';
const LEGACY_CONFIG_FILE_PATH = join(LEGACY_CONFIG_FOLDER, LEGACY_CONFIG_NAME);
const DEFAULT_JDK_FOLDER = join(DEFAULT_CONFIG_FOLDER, 'jdk');

async function createConfig(prompt: Prompt = new InquirerPrompt()): Promise<Config> {
  const jdkInstallRequest = await prompt.promptConfirm('Do you want Bubblewrap to install JDK? ' +
    '(Enter "No" to use your JDK installation)', true);

  let jdkPath;
  if (!jdkInstallRequest) {
    jdkPath = await prompt.promptInput('Path to your existing JDK:', null,
        JdkHelper.validatePath);
  } else {
    await fsPromises.mkdir(DEFAULT_JDK_FOLDER);
    console.log(`Downloading JDK 8 to ${DEFAULT_JDK_FOLDER}`);
    const jdkInstaller = new JdkInstaller(process);
    jdkPath = await jdkInstaller.install(DEFAULT_JDK_FOLDER);
  }
  const androidSdkPath = await prompt.promptInput('Path to the Android SDK:', null,
      AndroidSdkTools.validatePath);

  return new Config(jdkPath, androidSdkPath);
}

async function renameConfigIfNeeded(log: Log): Promise<void> {
  if (existsSync(DEFAULT_CONFIG_FILE_PATH)) return;
  // No new named config file found.
  if (!existsSync(LEGACY_CONFIG_FILE_PATH)) return;
  // Old named config file found - rename it and its folder.
  log.info('An old named config file was found, changing it now');
  const files = await fsPromises.readdir(LEGACY_CONFIG_FOLDER);
  const numOfFiles = files.length;
  if (numOfFiles != 1) {
    // At this point, we know that's at least one file in the folder, `LEGACY_CONFIG_NAME, so
    // `numOfFiles' will be at least `1`. We avoid destroying / moving other files in this folder.
    await fsPromises.mkdir(DEFAULT_CONFIG_FOLDER);
    await fsPromises.rename(LEGACY_CONFIG_FILE_PATH, DEFAULT_CONFIG_FILE_PATH);
  } else {
    await fsPromises.rename(LEGACY_CONFIG_FOLDER, DEFAULT_CONFIG_FOLDER);
    await fsPromises
        .rename(join(DEFAULT_CONFIG_FOLDER, LEGACY_CONFIG_NAME), DEFAULT_CONFIG_FILE_PATH);
  }
}

export async function loadOrCreateConfig(log: Log = new ConsoleLog('config'),
    prompt: Prompt = new InquirerPrompt(), path = DEFAULT_CONFIG_FILE_PATH): Promise<Config> {
  await renameConfigIfNeeded(log);
  const existingConfig = await Config.loadConfig(path);
  if (existingConfig) return existingConfig;

  const config = await createConfig(prompt);
  await config.saveConfig(path);
  return config;
}
