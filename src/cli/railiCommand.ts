export class RailiCommand {
  public readonly value: string;
  public readonly isFlagHelp: boolean; // --help or -h at top-level
  public readonly help: boolean; // the 'help' command
  public readonly init: boolean;
  public readonly run: boolean;
  public readonly docs: boolean;
  public readonly schema: boolean;
  public readonly stats: boolean;
  public readonly teach: boolean;
  public readonly listen: boolean;

  constructor(value?: string) {
    this.value = value ?? '';
    this.isFlagHelp = this.value === '--help' || this.value === '-h';
    this.help = this.value === 'help';
    this.init = this.value === 'init';
    this.run = this.value === 'run';
    this.docs = this.value === 'docs';
    this.schema = this.value === 'schema';
    this.stats = this.value === 'stats';
    this.teach = this.value === 'teach';
    this.listen = this.value === 'listen';
  }
}
