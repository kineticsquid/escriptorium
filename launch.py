import traceback
import subprocess
import re

SOURCE_FILE_NAME = 'variables.env_example'
DESTINATION_FILE_NAME = 'variables.env'
VAR_NAME = 'CSRF_TRUSTED_ORIGINS'


def main():
    try:
        result_bytes = subprocess.run(['docker-compose', 'down'], stdout=subprocess.PIPE)
        result_bytes = subprocess.run(['docker-compose', 'up', '-d'], stdout=subprocess.PIPE)
        result_bytes = subprocess.run(['gp', 'ports', 'list'], stdout=subprocess.PIPE)
        result = result_bytes.stdout.decode('utf-8')
        regex = '(open \(public\)|open \(private\))(.+)(https:.+gitpod.io)'
        regex_results = re.findall(regex, result)
        new_trusted_origins = ''
        for item in regex_results:
            if item[0] == 'open (public)':
                new_trusted_origins = '%s,%s' % (new_trusted_origins, item[2])
        if new_trusted_origins == '':
            subprocess.run(['cp', 'variables.env_example', 'variables.env'], stdout=subprocess.PIPE)
        else:
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