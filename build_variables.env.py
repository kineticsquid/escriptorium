import traceback
import os
import argparse

SOURCE_FILE_NAME = 'variables.env_example'
DESTINATION_FILE_NAME = 'variables.env'
VAR_NAME = 'CSRF_TRUSTED_ORIGINS'

def get_args():
    parser = argparse.ArgumentParser(
        description='Generates variables.env file from example file and adds gitpod URLs to CSRF_TRUSTED_ORIGINS.')
    # Add arguments
    parser.add_argument(
        '-s', '--source', type=str, help='Source file for generating variables.env. Default is variables.env_example.', default=SOURCE_FILE_NAME)
    parser.add_argument(
        '-d', '--destination', type=str, help='File being generated. Default is variables.env.', default=DESTINATION_FILE_NAME)
    parser.add_argument(
        '-p', '--ports', type=str, help='Comma separated list of ports for URLs to be added. Default is 8080.', default='8080')

    args = parser.parse_args()
    return args.source, args.destination, args.ports


def main():

    try:
        source_file_name, destination_file_name, ports_string = get_args()
        ports = ports_string.split(',')
        workspace_url = os.getenv('GITPOD_WORKSPACE_URL')
        new_trusted_origins = ''
        for port in ports:
            new_trusted_origins = "%s,%s%s-%s" % (new_trusted_origins, workspace_url[:8], port.strip(), workspace_url[8:])

        source_file = open(SOURCE_FILE_NAME, 'r')
        destination_file = open(DESTINATION_FILE_NAME, 'w')
        for line in source_file.readlines():
            if line.find(VAR_NAME) < 0:
                destination_file.write(line)
            else:
                new_trusted_origins_line = line.strip() + new_trusted_origins + '\n'
                destination_file.write(new_trusted_origins_line)
        source_file.close()
        destination_file.close()

    except Exception as e:
        print('Error: ' + str(e))
        traceback.print_exc()

if __name__ == '__main__':
    main()