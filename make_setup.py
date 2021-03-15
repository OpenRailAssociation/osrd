from os import environ, popen
from urllib.parse import urlparse

NAME = 'osrd'

if environ['CI_COMMIT_REF_NAME'] != 'prod':
    NAME += '-' + environ['CI_COMMIT_REF_NAME']

MINOR = 1

if 'READ_PACKAGE_REGISTRY_USER' in environ and 'READ_PACKAGE_REGISTRY_PASSWD' in environ:
    user = environ['READ_PACKAGE_REGISTRY_USER']
    passwd = environ['READ_PACKAGE_REGISTRY_PASSWD']
    PROJECT_ID = environ['CI_PROJECT_ID']
    pcmd = f'gitlab.com/api/v4/projects/{PROJECT_ID}/packages/pypi/simple/{NAME}'
    pcmd += ' | grep -Po \'(?<=href=")[^"]*\' -'
    results = popen(f'curl https://{user}:{passwd}@{pcmd}').read().strip().split('\n')
    for result in results:
        path = urlparse(result).path
        name = path[path.rfind('/') + 1:]
        name = name[len(NAME) + 1:-7]
        name = name[name.rfind('.') + 1:]
        if len(name) == 0:
            continue
        minor = int(name)
        if minor + 1 > MINOR:
            MINOR = minor + 1
else:
    print("Did not find 'read package registry' user and password in environment: suspicious")

with open('setup.py', 'w') as fh:
    fh.write(f'''import setuptools

NAME = '{NAME}'

MINOR = {MINOR}

with open('README.md', 'r') as fh:
    long_description = fh.read()

setuptools.setup(
    name=NAME,
    version='0.0.{MINOR}',
    author='DGEX Solutions',
    packages=setuptools.find_packages(),
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/osrdata/services/osrd',
)
''')
