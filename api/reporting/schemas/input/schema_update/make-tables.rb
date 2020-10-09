#!/usr/bin/ruby
require 'open3'
require 'yaml'

# A poor-man's replacement for Terraform, intended to be temporary.
INPUT_YAML = ARGV[0]
pp INPUT_YAML

INPUT = YAML.load_file(INPUT_YAML)

def qualify_table_name(project, dataset, table_name)
  "#{project}:#{dataset}.#{table_name}"
end

def make_table(project, dataset, table_name, description, schema_path)
  commands = %W[bq mk \
    --description "#{description}" \
    --table \
    #{qualify_table_name(project, dataset, table_name)} \
    #{schema_path}]
  command_line = commands.map(&:strip).join(' ')
  run_command_line(command_line)
end

def run_command_line(command_line)
  p command_line
  _stdout, output, _status = Open3.capture3(command_line)
  puts output if output
  puts _stdout if _stdout.strip
end

JOB = INPUT['job']
JOB['tables'].each do |table|
  make_table(JOB['project'], JOB['dataset'], table['name'], table['description'], table['schemaPath'])
end
