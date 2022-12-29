import traceback
import os
import subprocess

SOURCE_FILE_NAME = 'variables.env_example'
DESTINATION_FILE_NAME = 'variables.env'
VAR_NAME = 'CSRF_TRUSTED_ORIGINS'

def main():
    try:
        result_bytes = subprocess.run(['gp ports list'], stdout=subprocess.PIPE)
        result = result_bytes.stdout.decode('utf-8')
        print(result)


    except Exception as e:

        print('Error: ' + str(e))
        traceback.print_exc()


if __name__ == '__main__':
    main()