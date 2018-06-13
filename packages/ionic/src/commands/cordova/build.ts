import chalk from 'chalk';

import { CommandMetadataOption, validators } from '@ionic/cli-framework';
import { BuildOptions, CommandInstanceInfo, CommandLineInputs, CommandLineOptions, CommandMetadata, CommandPreRun } from '@ionic/cli-utils';
import { BuildRunner } from '@ionic/cli-utils/lib/build';
import { RunnerNotFoundException } from '@ionic/cli-utils/lib/errors';
import { filterArgumentsForCordova, generateBuildOptions } from '@ionic/cli-utils/lib/integrations/cordova/utils';

import { COMMON_CORDOVA_BUILD_COMMAND_OPTIONS, CORDOVA_BUILD_EXAMPLE_COMMANDS, CordovaCommand } from './base';

export class BuildCommand extends CordovaCommand implements CommandPreRun {
  protected buildRunner?: BuildRunner<BuildOptions<any>>;

  async getBuildRunner() {
    if (!this.buildRunner) {
      this.buildRunner = await BuildRunner.createFromProject(this.env, this.env.project);
    }

    return this.buildRunner;
  }

  async getMetadata(): Promise<CommandMetadata> {
    const options: CommandMetadataOption[] = [
      // Build Options
      {
        name: 'build',
        summary: 'Do not invoke an Ionic build',
        type: Boolean,
        default: true,
      },
      ...COMMON_CORDOVA_BUILD_COMMAND_OPTIONS,
    ];

    try {
      const runner = await this.getBuildRunner();
      const libmetadata = await runner.getCommandMetadata();
      options.push(...libmetadata.options || []);
    } catch (e) {
      if (!(e instanceof RunnerNotFoundException)) {
        throw e;
      }
    }

    return {
      name: 'build',
      type: 'project',
      summary: 'Build (prepare + compile) an Ionic project for a given platform',
      description: `
Like running ${chalk.green('cordova build')} directly, but also builds web assets with configuration from ${chalk.green('ionic build')} and provides friendly checks.

To pass additional options to the Cordova CLI, use the ${chalk.green('--')} separator after the Ionic CLI arguments.

The Cordova CLI requires a separator for platform-specific arguments for Android builds${chalk.cyan('[1]')}, so an additional separator is required for the Ionic CLI, but it is not required for iOS builds${chalk.cyan('[2]')}. See the example commands for usage with separators. To avoid using flags, consider using ${chalk.green('--buildConfig')} with a ${chalk.bold('build.json')} file.

${chalk.cyan('[1]')}: ${chalk.bold('https://cordova.apache.org/docs/en/latest/guide/platforms/android/index.html#using-flags')}
${chalk.cyan('[2]')}: ${chalk.bold('https://cordova.apache.org/docs/en/latest/guide/platforms/ios/index.html#using-flags')}
      `,
      exampleCommands: CORDOVA_BUILD_EXAMPLE_COMMANDS,
      inputs: [
        {
          name: 'platform',
          summary: `The platform to build (e.g. ${['android', 'ios'].map(v => chalk.green(v)).join(', ')})`,
          validators: [validators.required],
        },
      ],
      options,
    };
  }

  async preRun(inputs: CommandLineInputs, options: CommandLineOptions, runinfo: CommandInstanceInfo): Promise<void> {
    await this.preRunChecks(runinfo);

    if (!inputs[0]) {
      const platform = await this.env.prompt({
        type: 'input',
        name: 'platform',
        message: `What platform would you like to build (${['android', 'ios'].map(v => chalk.green(v)).join(', ')}):`,
      });

      inputs[0] = platform.trim();
    }

    await this.checkForPlatformInstallation(inputs[0]);
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const metadata = await this.getMetadata();

    if (options.build) {
      const { build } = await import('@ionic/cli-utils/lib/build');
      await build(this.env, inputs, generateBuildOptions(metadata, inputs, options));
    }

    const cordovaArgs = filterArgumentsForCordova(metadata, options);
    await this.runCordova(cordovaArgs, {});
  }
}
