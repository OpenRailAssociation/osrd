from rest_framework.authentication import BaseAuthentication
from typing import List, Dict
from django.contrib.auth.models import User, Group


class TestUser:
    def __init__(
        self,
        sub: str,
        username: str,
        first_name: str,
        last_name: str,
        email: str,
        roles: List[str],
        user_type: str,
    ):
        self.sub = sub
        self.username = username
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.is_staff = "staff" in roles
        self.is_active = True
        self.is_superuser = "superuser" in roles
        self.is_authenticated = True
        self.is_anonymous = False
        self.roles = roles
        self.user_type = user_type

    def __repr__(self):
        return f"test user {self.username}"

    @property
    def pk(self):
        qs = User.objects.filter(username=self.sub)
        if len(qs) != 0:
            return qs.first().pk
        user = User.objects.create(username=self.sub)
        return user.pk

    def get_username(self):
        return self.username

    def has_module_perms(self, package_name):
        """
        https://docs.djangoproject.com/en/3.2/ref/contrib/auth/#django.contrib.auth.models.User.has_module_perms
        """
        return "superuser" in self.roles or package_name in self.roles

    def has_perm(self, perm, obj=None):
        """
        https://docs.djangoproject.com/en/3.2/ref/contrib/auth/#django.contrib.auth.models.User.has_perm
        """
        if "superuser" in self.roles:
            return True

        if obj:
            return obj.lower() in self.roles

        return perm in self.roles

    def has_perms(self, perm_list, obj=None):
        """
        https://docs.djangoproject.com/en/3.2/ref/contrib/auth/#django.contrib.auth.models.User.has_perms
        """
        if obj:
            return obj.lower() in self.roles

        for perm in perm_list:
            if not self.has_perm(perm):
                return False

        return True

    def to_headers(self) -> Dict[str, str]:
        return {
            "X-Forwarded-User": self.sub,
            "X-Forwarded-User-Username": self.username,
            "X-Forwarded-User-First-Name": self.first_name,
            "X-Forwarded-User-Last-Name": self.last_name,
            "X-Forwarded-User-Email": self.email,
            "X-Forwarded-User-Roles": ",".join(self.roles),
            "X-Forwarded-User-Type": self.email,
        }


class MagicSet:
    def __contains__(self, o):
        return True


def make_test_user():
    return TestUser(
        '00000000-0000-0000-0000-000000000000',
        'joseph.marchand',
        'Joseph',
        'Marchand',
        'joseph.marchand@sncf.fr',
        MagicSet(),
        'short'
    )


class LocalUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user = make_test_user()
        return self.get_response(request)


class TestGatewayAuth(BaseAuthentication):
    def authenticate(self, request):
        return make_test_user(), None
